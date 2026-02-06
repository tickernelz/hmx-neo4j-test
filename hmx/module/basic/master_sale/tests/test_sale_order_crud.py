from django.utils import timezone

from hmx import exceptions
from hmx.tests.common import SavepointCase


class TestSaleOrderCrud(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={"no_track": 1})

        # Ensure sequences exist
        seq_quotation = cls.env["basesequence"].search([("code", "=", "sale.quotation")], limit=1)
        seq_order = cls.env["basesequence"].search([("code", "=", "sale.order")], limit=1)
        assert seq_quotation, "Sequence sale.quotation must be defined"
        assert seq_order, "Sequence sale.order must be defined"

        # Required master data
        cls.customer = cls.env["basepartner"].create(
            {
                "name": "Test Customer",
                "email": "customer@test.com",
                'mobile_number': '08123456788',
                'phone_number': '021999990',
            }
        )

        cls.product = cls.env["product"].create(
            {
                "name": "Test Product",
                "barcode": "TEST-BARCODE-001",
                "default_code": "TP-001",  # manual input
                "list_price": 100,
                "standard_price": 50,
                "categ": False,  # eksplisit: tidak pakai auto sequence
            }
        )

        cls.currency = cls.env["basecurrency"].search([], limit=1)
        assert cls.currency, "At least one currency must exist"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _order_vals(self, **extra):
        vals = {
            "customer": self.customer.id,
            "currency": self.currency.id,
            "delivery_date": timezone.now(),
        }
        vals.update(extra)
        return vals

    def _order_line_vals(self, order, **extra):
        product = self.env["product"].search([], limit=1)
        assert product, "At least one product must exist"

        vals = {
            "order": order.id,
            "product_lines": product.id,
            "quantity_lines": 2,
            "unit_price_lines": 100,
        }
        vals.update(extra)
        return vals

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def test_create_sale_order_default(self):
        order = self.env["saleorder"].create(self._order_vals())

        self.assertTrue(order.id)
        self.assertTrue(order.name)
        self.assertEqual(order.state, "draft")
        self.assertFalse(order.is_sale_order)

    def test_create_sale_order_with_custom_name(self):
        order = self.env["saleorder"].create(self._order_vals(name="SO-CUSTOM"))

        self.assertEqual(order.name, "SO-CUSTOM")

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    def test_compute_amount_from_order_lines(self):
        order = self.env["saleorder"].create(self._order_vals())

        self.env["saleorderlines"].create(self._order_line_vals(order))
        self.env["saleorderlines"].create(self._order_line_vals(order, quantity_lines=3, unit_price_lines=50))

        order.invalidate_cache()

        self.assertEqual(order.subtotal_sum, 2 * 100 + 3 * 50)
        self.assertEqual(order.total_sum, order.subtotal_sum)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    def test_write_allowed_in_draft(self):
        order = self.env["saleorder"].create(self._order_vals())

        order.write({"remarks": "Updated"})
        self.assertEqual(order.remarks, "Updated")

    def test_write_forbidden_when_closed(self):
        order = self.env["saleorder"].create(self._order_vals())
        order.action_confirm()
        order.action_close()

        with self.assertRaises(exceptions.ValidationError):
            order.write({"remarks": "Should fail"})

    # ------------------------------------------------------------------
    # State Transitions
    # ------------------------------------------------------------------
    def test_action_confirm(self):
        order = self.env["saleorder"].create(self._order_vals())
        old_name = order.name

        order.action_confirm()

        self.assertEqual(order.state, "sale")
        self.assertTrue(order.is_sale_order)
        self.assertEqual(order.sq_ref_name, old_name)
        self.assertNotEqual(order.name, old_name)

    def test_action_cancel(self):
        order = self.env["saleorder"].create(self._order_vals())
        order.action_cancel()

        self.assertEqual(order.state, "cancelled")

    def test_action_close(self):
        order = self.env["saleorder"].create(self._order_vals())
        order.action_confirm()
        order.action_close()

        self.assertEqual(order.state, "closed")

    # ------------------------------------------------------------------
    # Unlink
    # ------------------------------------------------------------------
    def test_unlink_sale_order(self):
        order = self.env["saleorder"].create(self._order_vals())
        order_id = order.id

        order.unlink()

        self.assertEqual(
            self.env["saleorder"].search_count([("id", "=", order_id)]),
            0,
        )
