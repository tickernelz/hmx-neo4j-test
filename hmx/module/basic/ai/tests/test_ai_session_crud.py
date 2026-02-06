from hmx.tests.common import SingleTransactionCase


class TestAISessionCRUD(SingleTransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={'no_track': 1})

        cls.config = cls.env['aiagentconfig'].create(
            {
                'name': 'Test Config',
                'email': 'config@example.com',
                'password': 'configpass',
                'use_config': True,
            }
        )

    def test_create_session(self):
        session = self.env['aisession'].create(
            {
                'name': 'Test Session',
                'config_id': self.config.id,
                'status': 'draft',
                'user_id': self.env.user.id,
            }
        )

        self.assertIsNotNone(session.id)
        self.assertEqual(session.name, 'Test Session')
        self.assertEqual(session.config_id.id, self.config.id)
        self.assertEqual(session.status, 'draft')
        self.assertEqual(session.user_id.id, self.env.user.id)
        self.assertIsNone(session.external_session_id)
        self.assertIn(session.external_employee_id, [None, 0])

    def test_write_session(self):
        session = self.env['aisession'].create(
            {
                'name': 'Initial Session',
                'config_id': self.config.id,
                'status': 'draft',
            }
        )

        session.write(
            {
                'name': 'Updated Session',
                'status': 'active',
                'external_session_id': 'ext_session_123',
                'external_employee_id': 456,
            }
        )

        self.assertEqual(session.name, 'Updated Session')
        self.assertEqual(session.status, 'active')
        self.assertEqual(session.external_session_id, 'ext_session_123')
        self.assertEqual(session.external_employee_id, 456)

        session.write(
            {
                'status': 'ended',
                'external_session_id': None,
                'external_employee_id': None,
            }
        )

        self.assertEqual(session.status, 'ended')
        self.assertIsNone(session.external_session_id)
        self.assertIn(session.external_employee_id, [None, 0])

    def test_unlink_session(self):
        session = self.env['aisession'].create(
            {
                'name': 'Session to Delete',
                'config_id': self.config.id,
                'status': 'draft',
            }
        )

        session_id = session.id
        self.assertIsNotNone(session_id)

        session.unlink()

        deleted_session = self.env['aisession'].search([('id', '=', session_id)])
        self.assertEqual(len(deleted_session), 0)

    def test_create_session_with_default_user(self):
        session = self.env['aisession'].create(
            {
                'name': 'Session with Default User',
                'config_id': self.config.id,
                'status': 'draft',
            }
        )

        self.assertIsNotNone(session.user_id)
        self.assertEqual(session.user_id.id, self.env.user.id)
