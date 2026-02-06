from django.utils import timezone

from hmx import exceptions
from hmx.tests.common import SavepointCase


class TestSaleCustomerCrud(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={"no_track": 1})

        seq = cls.env["basesequence"].search([("code", "=", "sale.customer")], limit=1)
        assert seq, "Sequence sale.customer must be defined in XML data"

        cls.customer_type = cls.env["basepartnertype"].search([("name", "=", "Customer")], limit=1)

    def _partner_vals(self, name, partner_type_name=None):
        base_number = abs(hash(name)) % 10000000
        phone_number = f"021{base_number:07d}"  # phone
        mobile_number = f"0821{(base_number + 1) % 10000000:07d}"  # mobile, different from phone

        vals = {
            "name": name,
            "email": f"{name.replace(' ', '').lower()}_{self.__class__.__name__}@test.com",
            "phone_number": phone_number,
            "mobile_number": mobile_number,
        }

        if partner_type_name:
            pt = self.env["basepartnertype"].search([("name", "=", partner_type_name)], limit=1)
            if pt:
                vals["partner_types"] = [(6, 0, [pt.id])]

        return vals

    def test_create_customer_auto_fields(self):
        customer = self.env["basepartner"].create(self._partner_vals("Customer A", "Customer"))

        self.assertTrue(customer.id)
        self.assertTrue(customer.customer_id)
        self.assertTrue(customer.customer_creation_date)
        self.assertTrue(customer.customer_id.startswith("CS-"))
        self.assertEqual(len(customer.customer_id), 7)

    def test_create_non_customer_no_customer_fields(self):
        partner = self.env["basepartner"].create(self._partner_vals("Non-Customer"))
        self.assertTrue(partner.id)
        self.assertIsNone(partner.customer_id)
        self.assertIsNone(partner.customer_creation_date)

    def test_multi_create_customer(self):
        customers = self.env["basepartner"].create(
            [
                self._partner_vals("Customer 1", "Customer"),
                self._partner_vals("Customer 2", "Customer"),
            ]
        )

        self.assertEqual(len(customers), 2)
        self.assertNotEqual(customers[0].customer_id, customers[1].customer_id)
        for c in customers:
            self.assertTrue(c.customer_id.startswith("CS-"))

    def test_write_customer_id_forbidden(self):
        customer = self.env["basepartner"].create(self._partner_vals("Customer Lock", "Customer"))

        with self.assertRaises(exceptions.ValidationError):
            customer.write({"customer_id": "CS-9999"})

        with self.assertRaises(exceptions.ValidationError):
            customer.write({"customer_creation_date": timezone.localdate()})

    def test_write_customer_id_with_skip_context(self):
        customer = self.env["basepartner"].create(self._partner_vals("Customer Bypass", "Customer"))

        customer.with_context(skip_customer_lock=True).write({"customer_id": "CS-9999"})
        self.assertEqual(customer.customer_id, "CS-9999")

    def test_change_partner_type_to_customer(self):
        partner = self.env["basepartner"].create(self._partner_vals("Before Customer"))
        self.assertIsNone(partner.customer_id)

        partner.write({"partner_types": [(6, 0, [self.customer_type.id])]})

        self.assertTrue(partner.customer_id)
        self.assertTrue(partner.customer_creation_date)
        self.assertTrue(partner.customer_id.startswith("CS-"))

    def test_unlink_customer(self):
        customer = self.env["basepartner"].create(self._partner_vals("Customer To Delete", "Customer"))

        customer_id = customer.id
        customer.unlink()

        self.assertEqual(self.env["basepartner"].search_count([("id", "=", customer_id)]), 0)

    def test_default_get_with_is_customer_context(self):
        env = self.env(context=dict(self.env.context, is_customer=True))

        Partner = env['basepartner']

        defaults = Partner.default_get(['partner_types'])

        self.assertIn('partner_types', defaults, "partner_types must be present in default_get if is_customer=True")

        customer_type = defaults['partner_types']

        self.assertTrue(customer_type, "partner_types cannot be False")
        self.assertEqual(customer_type.name, "Customer", "partner_types must be of type Customer")

    def test_default_get_without_context(self):
        Partner = self.env['basepartner']

        defaults = Partner.default_get(['partner_types'])

        self.assertNotIn('partner_types', defaults, "partner_types cannot exist if is_customer is not in context")

    def test_compute_full_address_with_default_address(self):
        default_type = self.env.ref(
            "base.base_partner_address_type_default",
            raise_if_not_found=False,
        )

        customer = self.env["basepartner"].create(self._partner_vals("Customer A", "Customer"))

        country = self.env.ref("base.id", raise_if_not_found=False)
        state = self.env.ref("base.state_id_jb", raise_if_not_found=False)
        self.env["basepartneraddress"].create(
            {
                "base_partner": customer.id,
                "address_type": default_type.id,
                "street": "Jalan Satu",
                "street2": "No.05",
                "country": country.id,
                "state": state.id if state else False,
                "city": "Bogor",
                "zip": "16845",
            }
        )

        customer.invalidate_cache()

        address = customer.full_address

        self.assertTrue(address)

        lines = address.split('\n')

        self.assertIn("Jalan Satu", lines[0])
        self.assertIn("Bogor", address)
        self.assertIn("Indonesia", address)
        self.assertTrue(address.endswith("16845"))
