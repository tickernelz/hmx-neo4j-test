import logging

from hmx.tests.common import SingleTransactionCase, TransactionCase, SavepointCase, tagged

from .common import SaleBaseTest

_logger = logging.getLogger(__name__)


class TestCrudHMX(SingleTransactionCase):
    """
    Example using SingleTransactionCase.
    
    In this test case, all test methods share a common transaction. Changes made in 
    one test method are visible to subsequent test methods. The transaction is started 
    with the first test method and rolled back after the last test method completes.
    
    This is useful for tests that build on each other's results or when you need to 
    test a complete workflow across multiple test methods.
    """
    def test_001_create(self):
        """Test record creation with validation of field values."""
        # Create a partner record that we'll use with our sale
        partner = self.env['partner'].create({
            'name': 'Partner A',
            'email': 'partnerAa@example.com',
            'user_id': self.env.user.pk,
            'company': self.env.company.pk,
        })

        record = self.env['sale'].create({
            'company': self.env.company.pk,
            'partner_id': partner.pk,
            'status': 'draft',
            'price': 10_000
        })
        self.assertIsNotNone(record.pk)
        self.assertEqual(record.company.pk, self.env.company.pk)
        self.assertEqual(record.partner_id.pk, partner.pk)
        self.assertEqual(record.status, 'draft')
        self.assertEqual(record.price, 10_000)

    def test_002_write(self):
        """Test record update (write) - expects to find the record created in test_001_create."""
        # Search for the partner created in the previous test - we should find it
        # because SingleTransactionCase preserves changes between test methods
        record = self.env['sale'].search([('partner_id.name', '=', 'Partner A')])
        self.assertEqual(len(record), 1)

        partner = self.env['partner'].create({
            'name': 'Partner B',
            'email': 'partnerB@example.com',
            'user_id': self.env.user.pk,
            'company': self.env.company.pk,
        })

        record.write({
            'partner_id': partner.pk,
            'price': 20_000
        })
        self.assertEqual(record.partner_id.pk, partner.pk)
        self.assertEqual(record.price, 20_000)

    def test_003_unlink(self):
        """Test record deletion (unlink) - expects to find the record modified in test_002_write."""
        # Search for the partner modified in the previous test - we should find it
        # because SingleTransactionCase preserves changes between test methods
        record = self.env['sale'].search([('partner_id.name', '=', 'Partner B')])
        self.assertEqual(len(record), 1)

        record.unlink()
        record = self.env['sale'].search([('partner_id.name', '=', 'Partner B')])
        self.assertEqual(len(record), 0)


@tagged('hello')
class TestSavepointCase(SavepointCase):
    """
    Example using SavepointCase.
    
    In this test case, each test method runs within its own database savepoint.
    Changes made in one test method are rolled back to the savepoint when the method
    finishes, so they are not visible to other test methods.
    
    This provides test isolation with better performance than TransactionCase since
    it doesn't need to create a completely new transaction for each test method.
    """
    def test_001_create_record(self):
        """Test record creation with validation of field values."""
        # Log the current savepoint ID for debugging purposes
        _logger.info("We are on savepoint %s", self._savepoint_id)

        partner = self.env['partner'].create({
            'name': 'Partner XXX',
            'email': 'partnerXXXa@example.com',
            'user_id': self.env.user.pk,
            'company': self.env.company.pk,
        })

        record = self.env['sale'].create({
            'company': self.env.company.pk,
            'partner_id': partner.pk,
            'status': 'draft',
            'price': 10_000
        })
        self.assertIsNotNone(record.pk)
        self.assertEqual(record.company.pk, self.env.company.pk)
        self.assertEqual(record.partner_id.pk, partner.pk)
        self.assertEqual(record.status, 'draft')
        self.assertEqual(record.price, 10_000)

    def test_002_get_from_test_001(self):
        """Test that changes from test_001_create_record are not visible (rolled back)."""
        # Log the current savepoint ID for debugging purposes - should be different from test_001
        _logger.info("We are on savepoint %s", self._savepoint_id)
        record = self.env['sale'].search([('partner_id.name', '=', 'Partner XXX')])
        self.assertEqual(len(record), 0)


@tagged('-at_install', 'post_install', 'world')
class TestTransactionCase(TransactionCase):
    """
    Example using TransactionCase.
    
    In this test case, each test method runs in a completely separate transaction.
    Changes made in one test method are rolled back when the method finishes, so
    they are not visible to other test methods.
    
    This provides complete test isolation, with each test starting with a fresh
    database state.

     Tag explanation:
    - '-at_install': This test will NOT run when the module is being installed.
                     All tests have the 'at_install' tag by default, so we must
                     explicitly remove it using the minus prefix if we don't want
                     the test to run during installation.
    - 'post_install': This test will run after all modules have been installed
    - 'world': Custom tag to categorize this test for selective running
    """
    def test_001_create_record(self):
        """Test record creation with validation of field values."""
        # Create a partner and sale record
        partner = self.env['partner'].create({
            'name': 'Partner ABC',
            'email': 'partnerABCa@example.com',
            'user_id': self.env.user.pk,
            'company': self.env.company.pk,
        })

        record = self.env['sale'].create({
            'company': self.env.company.pk,
            'partner_id': partner.pk,
            'status': 'draft',
            'price': 10_000
        })
        self.assertIsNotNone(record.pk)
        self.assertEqual(record.company.pk, self.env.company.pk)
        self.assertEqual(record.partner_id.pk, partner.pk)
        self.assertEqual(record.status, 'draft')
        self.assertEqual(record.price, 10_000)

    def test_002_get_from_test_001(self):
        """Test that changes from test_001_create_record are not visible (rolled back)."""
        # Search for the record created in test_001 - we should NOT find it
        # because TransactionCase rolls back after each test method
        record = self.env['sale'].search([('partner_id.name', '=', 'Partner ABC')])
        self.assertEqual(len(record), 0)
