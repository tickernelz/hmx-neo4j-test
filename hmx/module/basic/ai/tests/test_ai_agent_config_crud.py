from hmx.tests.common import SingleTransactionCase


class TestAIAgentConfigCRUD(SingleTransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={'no_track': 1})

    def test_create_config(self):
        config = self.env['aiagentconfig'].create(
            {
                'name': 'Test Config',
                'email': 'test@example.com',
                'password': 'testpassword123',
                'base_url': 'https://test.hashmicro.com/api/v1',
                'state': 'draft',
                'status': 'draft',
                'use_config': False,
            }
        )

        self.assertIsNotNone(config.id)
        self.assertEqual(config.name, 'Test Config')
        self.assertEqual(config.email, 'test@example.com')
        self.assertEqual(config.password, 'testpassword123')
        self.assertEqual(config.base_url, 'https://test.hashmicro.com/api/v1')
        self.assertEqual(config.state, 'draft')
        self.assertEqual(config.status, 'draft')
        self.assertEqual(config.use_config, False)
        self.assertIsNone(config.token)
        self.assertIsNone(config.refreshtoken)

    def test_write_config(self):
        config = self.env['aiagentconfig'].create(
            {
                'name': 'Initial Config',
                'email': 'initial@example.com',
                'password': 'initialpass',
                'state': 'draft',
                'use_config': False,
            }
        )

        config.write(
            {
                'name': 'Updated Config',
                'email': 'updated@example.com',
                'password': 'updatedpass',
                'state': 'connected',
                'status': 'connected',
                'token': 'test_token_123',
                'refreshtoken': 'test_refresh_token_456',
                'use_config': True,
            }
        )

        self.assertEqual(config.name, 'Updated Config')
        self.assertEqual(config.email, 'updated@example.com')
        self.assertEqual(config.password, 'updatedpass')
        self.assertEqual(config.state, 'connected')
        self.assertEqual(config.status, 'connected')
        self.assertEqual(config.token, 'test_token_123')
        self.assertEqual(config.refreshtoken, 'test_refresh_token_456')
        self.assertEqual(config.use_config, True)

        config.write(
            {
                'name': None,
                'token': None,
                'refreshtoken': None,
                'use_config': False,
            }
        )

        self.assertIsNone(config.name)
        self.assertIsNone(config.token)
        self.assertIsNone(config.refreshtoken)
        self.assertEqual(config.use_config, False)

    def test_unlink_config(self):
        config = self.env['aiagentconfig'].create(
            {
                'name': 'Config to Delete',
                'email': 'delete@example.com',
                'password': 'deletepass',
            }
        )

        config_id = config.id
        self.assertIsNotNone(config_id)

        config.unlink()

        deleted_config = self.env['aiagentconfig'].search([('id', '=', config_id)])
        self.assertEqual(len(deleted_config), 0)
