from hmx.tests.common import SingleTransactionCase


class TestAIMessageCRUD(SingleTransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={'no_track': 1})

        cls.config = cls.env['aiagentconfig'].create(
            {
                'name': 'Test Config',
                'email': 'config@example.com',
                'password': 'configpass',
            }
        )

        cls.session = cls.env['aisession'].create(
            {
                'name': 'Test Session',
                'config_id': cls.config.id,
                'status': 'active',
            }
        )

    def test_create_user_message(self):
        message = self.env['aimessage'].create(
            {
                'name': 'User Message',
                'text': 'Hello, this is a user message',
                'message_type': 'user',
                'session_id': self.session.id,
            }
        )

        self.assertIsNotNone(message.id)
        self.assertEqual(message.name, 'User Message')
        self.assertEqual(message.text, 'Hello, this is a user message')
        self.assertEqual(message.message_type, 'user')
        self.assertEqual(message.session_id.id, self.session.id)
        self.assertIsNone(message.external_message_id)
        self.assertIsNone(message.context_mentioned)

    def test_create_ai_message(self):
        message = self.env['aimessage'].create(
            {
                'name': 'AI Response',
                'text': 'This is an AI response',
                'message_type': 'ai',
                'session_id': self.session.id,
            }
        )

        self.assertIsNotNone(message.id)
        self.assertEqual(message.name, 'AI Response')
        self.assertEqual(message.text, 'This is an AI response')
        self.assertEqual(message.message_type, 'ai')
        self.assertEqual(message.session_id.id, self.session.id)

    def test_write_message(self):
        message = self.env['aimessage'].create(
            {
                'name': 'Initial Message',
                'text': 'Initial text',
                'message_type': 'user',
                'session_id': self.session.id,
            }
        )

        message.write(
            {
                'name': 'Updated Message',
                'text': 'Updated text',
                'external_message_id': 'ext_msg_123',
                'context_mentioned': 'Some context information',
            }
        )

        self.assertEqual(message.name, 'Updated Message')
        self.assertEqual(message.text, 'Updated text')
        self.assertEqual(message.external_message_id, 'ext_msg_123')
        self.assertEqual(message.context_mentioned, 'Some context information')

        message.write(
            {
                'external_message_id': None,
                'context_mentioned': None,
            }
        )

        self.assertIsNone(message.external_message_id)
        self.assertIsNone(message.context_mentioned)

    def test_unlink_message(self):
        message = self.env['aimessage'].create(
            {
                'name': 'Message to Delete',
                'text': 'Delete this message',
                'message_type': 'user',
                'session_id': self.session.id,
            }
        )

        message_id = message.id
        self.assertIsNotNone(message_id)

        message.unlink()

        deleted_message = self.env['aimessage'].search([('id', '=', message_id)])
        self.assertEqual(len(deleted_message), 0)

    def test_multiple_messages_in_session(self):
        new_session = self.env['aisession'].create(
            {
                'name': 'Multi Message Session',
                'config_id': self.config.id,
                'status': 'active',
            }
        )

        message1 = self.env['aimessage'].create(
            {
                'name': 'Message 1',
                'text': 'First message',
                'message_type': 'user',
                'session_id': new_session.id,
            }
        )

        message2 = self.env['aimessage'].create(
            {
                'name': 'Message 2',
                'text': 'Second message',
                'message_type': 'ai',
                'session_id': new_session.id,
            }
        )

        message3 = self.env['aimessage'].create(
            {
                'name': 'Message 3',
                'text': 'Third message',
                'message_type': 'user',
                'session_id': new_session.id,
            }
        )

        session_messages = self.env['aimessage'].search([('session_id', '=', new_session.id)])
        self.assertEqual(len(session_messages), 3)

        message_ids = {message1.id, message2.id, message3.id}
        self.assertEqual(set(session_messages.ids), message_ids)

    def test_cascade_delete_session(self):
        new_session = self.env['aisession'].create(
            {
                'name': 'Session for Cascade Test',
                'config_id': self.config.id,
                'status': 'active',
            }
        )

        message1 = self.env['aimessage'].create(
            {
                'name': 'Message 1',
                'text': 'Message in session',
                'message_type': 'user',
                'session_id': new_session.id,
            }
        )

        message2 = self.env['aimessage'].create(
            {
                'name': 'Message 2',
                'text': 'Another message',
                'message_type': 'ai',
                'session_id': new_session.id,
            }
        )

        message1_id = message1.id
        message2_id = message2.id

        new_session.unlink()

        deleted_messages = self.env['aimessage'].search([('id', 'in', [message1_id, message2_id])])
        self.assertEqual(len(deleted_messages), 0)
