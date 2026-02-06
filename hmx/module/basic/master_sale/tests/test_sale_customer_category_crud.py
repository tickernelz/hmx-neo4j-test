from hmx.tests.common import SavepointCase


class TestSaleCustomerCategoryCrud(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={"no_track": 1})

        cls.company = cls.env["base.basecompany"].search([], limit=1)
        assert cls.company, "At least one company must exist for test"

    def test_create_customer_category(self):
        category = self.env["salecustomercategory"].create(
            {
                "name": "Retail Customer",
                "description": "Retail segment",
            }
        )

        self.assertTrue(category.id)
        self.assertEqual(category.name, "Retail Customer")
        self.assertEqual(category.description, "Retail segment")

    def test_read_customer_category(self):
        category = self.env["salecustomercategory"].create({"name": "Wholesale"})

        fetched = self.env["salecustomercategory"].browse(category.id)
        self.assertEqual(fetched.name, "Wholesale")

    def test_update_customer_category(self):
        category = self.env["salecustomercategory"].create({"name": "Old Name"})

        category.write({"name": "New Name"})

        self.assertEqual(category.name, "New Name")

    def test_delete_customer_category(self):
        category = self.env["salecustomercategory"].create({"name": "Temporary Category"})

        category_id = category.id
        category.unlink()

        self.assertEqual(
            self.env["salecustomercategory"].search_count([("id", "=", category_id)]),
            0,
        )
