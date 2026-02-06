from hmx.tests.common import SingleTransactionCase


class TestAIKnowledgeCRUD(SingleTransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context={'no_track': 1})

    def test_create_knowledge_text(self):
        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Test Knowledge',
                'title': 'Test Title',
                'content': 'This is test content',
                'document_type': 'text',
                'status': 'active',
            }
        )

        self.assertIsNotNone(knowledge.id)
        self.assertEqual(knowledge.name, 'Test Knowledge')
        self.assertEqual(knowledge.title, 'Test Title')
        self.assertEqual(knowledge.content, 'This is test content')
        self.assertEqual(knowledge.document_type, 'text')
        self.assertEqual(knowledge.status, 'active')
        self.assertIn(knowledge.external_id, [None, 0])
        self.assertIsNone(knowledge.source_url)
        self.assertIsNone(knowledge.metadata)

    def test_create_knowledge_file(self):
        import ast
        import json

        metadata = {
            'originalFileName': 'test.pdf',
            'fileSize': 1024,
            'wordCount': 500,
            'characterCount': 3000,
            'hasImages': True,
            'imageCount': 5,
            'mimeType': 'application/pdf',
        }

        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'File Knowledge',
                'title': 'File Title',
                'content': 'File content',
                'document_type': 'file',
                'source_url': '/public/uploads/test.pdf',
                'metadata': metadata,
                'status': 'active',
            }
        )

        self.assertIsNotNone(knowledge.id)
        self.assertEqual(knowledge.document_type, 'file')
        self.assertEqual(knowledge.source_url, '/public/uploads/test.pdf')
        if isinstance(knowledge.metadata, str):
            try:
                parsed_metadata = json.loads(knowledge.metadata)
            except json.JSONDecodeError:
                parsed_metadata = ast.literal_eval(knowledge.metadata)
            self.assertEqual(parsed_metadata, metadata)
        else:
            self.assertEqual(knowledge.metadata, metadata)

    def test_create_knowledge_qa(self):
        import ast
        import json

        metadata = {
            'answer': 'This is the answer to the question',
        }

        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Q&A Knowledge',
                'title': 'What is AI?',
                'content': 'What is artificial intelligence?',
                'document_type': 'qa',
                'metadata': metadata,
                'status': 'active',
            }
        )

        self.assertIsNotNone(knowledge.id)
        self.assertEqual(knowledge.document_type, 'qa')
        if isinstance(knowledge.metadata, str):
            try:
                parsed_metadata = json.loads(knowledge.metadata)
            except json.JSONDecodeError:
                parsed_metadata = ast.literal_eval(knowledge.metadata)
            self.assertEqual(parsed_metadata, metadata)
        else:
            self.assertEqual(knowledge.metadata, metadata)

    def test_write_knowledge(self):
        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Initial Knowledge',
                'title': 'Initial Title',
                'content': 'Initial content',
                'document_type': 'text',
                'status': 'active',
            }
        )

        knowledge.write(
            {
                'name': 'Updated Knowledge',
                'title': 'Updated Title',
                'content': 'Updated content',
                'external_id': 123,
                'odoo_service_id': 456,
                'user_id': 789,
                'vector_ids': [1, 2, 3],
            }
        )

        import json

        self.assertEqual(knowledge.name, 'Updated Knowledge')
        self.assertEqual(knowledge.title, 'Updated Title')
        self.assertEqual(knowledge.content, 'Updated content')
        self.assertEqual(knowledge.external_id, 123)
        self.assertEqual(knowledge.odoo_service_id, 456)
        self.assertEqual(knowledge.user_id, 789)
        if isinstance(knowledge.vector_ids, str):
            self.assertEqual(json.loads(knowledge.vector_ids), [1, 2, 3])
        else:
            self.assertEqual(knowledge.vector_ids, [1, 2, 3])

        knowledge.write(
            {
                'external_id': None,
                'source_url': None,
                'metadata': None,
            }
        )

        self.assertIn(knowledge.external_id, [None, 0])
        self.assertIsNone(knowledge.source_url)
        self.assertIsNone(knowledge.metadata)

    def test_unlink_knowledge(self):
        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Knowledge to Delete',
                'title': 'Delete Title',
                'content': 'Delete content',
                'document_type': 'text',
            }
        )

        knowledge_id = knowledge.id
        self.assertIsNotNone(knowledge_id)

        knowledge.unlink()

        deleted_knowledge = self.env['aiknowledge'].search([('id', '=', knowledge_id)])
        self.assertEqual(len(deleted_knowledge), 0)

    def test_compute_file_metadata(self):
        metadata = {
            'originalFileName': 'document.pdf',
            'fileSize': 2048,
            'wordCount': 1000,
            'characterCount': 6000,
            'hasImages': True,
            'imageCount': 10,
            'mimeType': 'application/pdf',
        }

        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'File with Metadata',
                'title': 'File Title',
                'content': 'File content',
                'document_type': 'file',
                'metadata': metadata,
            }
        )

        self.assertEqual(knowledge.original_file_name, 'document.pdf')
        self.assertEqual(knowledge.file_size, 2048)
        self.assertEqual(knowledge.word_count, 1000)
        self.assertEqual(knowledge.character_count, 6000)
        self.assertEqual(knowledge.has_images, True)
        self.assertEqual(knowledge.image_count, 10)
        self.assertEqual(knowledge.mime_type, 'application/pdf')

    def test_compute_file_metadata_empty(self):
        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Text without Metadata',
                'title': 'Text Title',
                'content': 'Text content',
                'document_type': 'text',
            }
        )

        self.assertEqual(knowledge.original_file_name, '')
        self.assertEqual(knowledge.file_size, 0)
        self.assertEqual(knowledge.word_count, 0)
        self.assertEqual(knowledge.character_count, 0)
        self.assertEqual(knowledge.has_images, False)
        self.assertEqual(knowledge.image_count, 0)
        self.assertEqual(knowledge.mime_type, '')

    def test_compute_collection_metadata(self):
        metadata = {
            'collection_id': 'col_123',
            'total_chunks': 50,
        }

        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Knowledge with Collection',
                'title': 'Collection Title',
                'content': 'Collection content',
                'document_type': 'text',
                'metadata': metadata,
            }
        )

        self.assertEqual(knowledge.collection_id, 'col_123')
        self.assertEqual(knowledge.total_chunks, 50)

    def test_compute_qa_metadata(self):
        metadata = {
            'answer': 'This is the detailed answer',
        }

        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Q&A with Answer',
                'title': 'Question Title',
                'content': 'What is the question?',
                'document_type': 'qa',
                'metadata': metadata,
            }
        )

        self.assertEqual(knowledge.answer, 'This is the detailed answer')

    def test_compute_qa_metadata_empty(self):
        knowledge = self.env['aiknowledge'].create(
            {
                'name': 'Text without Answer',
                'title': 'Text Title',
                'content': 'Text content',
                'document_type': 'text',
            }
        )

        self.assertEqual(knowledge.answer, '')
