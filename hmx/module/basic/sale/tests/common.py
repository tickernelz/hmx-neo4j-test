from hmx.tests.common import TransactionCase


class SaleBaseTest(TransactionCase):
    @classmethod
    def setUpClass(cls):
        """
        Class-level setup that runs once before any test methods are executed.
        
        This method creates test data that will be shared across all test methods.
        Use this for expensive operations that don't need to be repeated for each test.
        
        Example:
            - Creating master data records
            - Setting up shared test fixtures
            - Preparing test environment
            
        Note:
            Data created here will persist throughout all tests in this class.
            Changes to this data in one test will be visible in subsequent tests.
        """
        
        super().setUpClass()
        
        cls.partner_A = cls.env['partner'].create({
            'name': 'Partner A',
            'email': 'partnerA@example.com',
            'user_id': cls.env.user.pk
        })

        cls.partner_B = cls.env['partner'].create({
            'name': 'Partner B',
            'email': 'partnerB@example.com',
            'user_id': cls.env.user.pk
        })

    @classmethod
    def tearDownClass(cls):
        """
        Class-level cleanup that runs once after all test methods have completed.
        
        This method cleans up resources created in setUpClass.
        
        Example uses:
            - Removing test data created in setUpClass
            - Closing shared connections
            - Cleaning up the test environment
            
        Note:
            In Django's TestCase, database operations are usually rolled back automatically,
            but external resources may need explicit cleanup.
        """
        super().tearDownClass()
    
    def setUp(self):
        """
        Method-level setup that runs before each individual test method.
        
        This method prepares the test environment for a single test.
        Use this for test-specific setup that should be isolated between tests.
        
        Example uses:
            - Creating test-specific records
            - Resetting state between tests
            - Mocking/patching functionality
            
        Note:
            In Django's TestCase, each test runs in its own transaction that is
            rolled back after the test completes, isolating database changes.
        """
        super().setUp()

    def tearDown(self):
        """
        Method-level cleanup that runs after each individual test method.
        
        This method cleans up resources created in setUp.
        
        Example uses:
            - Removing test-specific records
            - Clearing caches
            - Restoring mocked functions
            
        Note:
            In Django's TestCase, database changes are automatically rolled back,
            but external resources may need explicit cleanup.
        """
        super().tearDown()
