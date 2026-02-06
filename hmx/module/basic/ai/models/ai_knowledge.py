import ast
import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api
from hmx.exceptions import ValidationError


_logger = logging.getLogger(__name__)


class AIKnowledge(models.Model):
    class Meta:
        name = "aiknowledge"
        verbose_name = _("AI Knowledge Base")
        ordering = ["-created_at"]

    name = models.CharField(_("Name"), max_length=255)
    external_id = models.IntegerField(_("External ID"), null=True, blank=True)
    title = models.CharField(_("Title"), max_length=255)
    content = models.TextField(_("Content"))
    document_type = models.CharField(
        _("Document Type"), max_length=10, choices=[('file', 'File'), ('text', 'Text'), ('qa', 'Q&A')]
    )
    source_url = models.CharField(_("Source URL"), max_length=500, null=True, blank=True)
    odoo_service_id = models.IntegerField(_("Odoo Service ID"), null=True, blank=True)
    user_id = models.IntegerField(_("User ID"), null=True, blank=True)
    metadata = models.JSONField(_("Metadata"), null=True, blank=True)
    vector_ids = models.JSONField(_("Vector IDs"), null=True, blank=True)
    status = models.CharField(_("Status"), max_length=20, default='active')
    created_at = models.DateTimeField(_("Created At"), null=True, blank=True)
    updated_at = models.DateTimeField(_("Updated At"), null=True, blank=True)

    original_file_name = models.CharField(
        _("Original File Name"), max_length=255, compute="_compute_file_metadata", store=False
    )
    file_size = models.IntegerField(_("File Size (bytes)"), compute="_compute_file_metadata", store=False)
    word_count = models.IntegerField(_("Word Count"), compute="_compute_file_metadata", store=False)
    character_count = models.IntegerField(_("Character Count"), compute="_compute_file_metadata", store=False)
    has_images = models.BooleanField(_("Has Images"), compute="_compute_file_metadata", store=False)
    image_count = models.IntegerField(_("Image Count"), compute="_compute_file_metadata", store=False)
    mime_type = models.CharField(_("MIME Type"), max_length=100, compute="_compute_file_metadata", store=False)
    collection_id = models.CharField(
        _("Collection ID"), max_length=100, compute="_compute_collection_metadata", store=False
    )
    total_chunks = models.IntegerField(_("Total Chunks"), compute="_compute_collection_metadata", store=False)
    answer = models.TextField(_("Answer"), compute="_compute_qa_metadata", store=False)

    @api.depends('metadata')
    def _compute_file_metadata(self):
        for rec in self:
            metadata_dict = {}
            if rec.metadata:
                if isinstance(rec.metadata, str):
                    try:
                        metadata_dict = ast.literal_eval(rec.metadata)
                    except (ValueError, TypeError):
                        metadata_dict = {}
                else:
                    metadata_dict = rec.metadata

            if metadata_dict and rec.document_type == 'file':
                rec.original_file_name = (
                    metadata_dict.get('originalFileName') or metadata_dict.get('original_file_name') or ''
                )
                rec.file_size = metadata_dict.get('fileSize') or 0
                rec.word_count = metadata_dict.get('wordCount') or 0
                rec.character_count = metadata_dict.get('characterCount') or 0
                rec.has_images = metadata_dict.get('hasImages') or False
                rec.image_count = metadata_dict.get('imageCount') or 0
                rec.mime_type = metadata_dict.get('mimeType') or ''
            else:
                rec.original_file_name = ''
                rec.file_size = 0
                rec.word_count = 0
                rec.character_count = 0
                rec.has_images = False
                rec.image_count = 0
                rec.mime_type = ''

    @api.depends('metadata')
    def _compute_collection_metadata(self):
        for rec in self:
            metadata_dict = {}
            if rec.metadata:
                if isinstance(rec.metadata, str):
                    try:
                        metadata_dict = ast.literal_eval(rec.metadata)
                    except (ValueError, TypeError):
                        metadata_dict = {}
                else:
                    metadata_dict = rec.metadata

            if metadata_dict:
                rec.collection_id = metadata_dict.get('collection_id') or ''
                rec.total_chunks = metadata_dict.get('total_chunks') or 0
            else:
                rec.collection_id = ''
                rec.total_chunks = 0

    @api.depends('metadata')
    def _compute_qa_metadata(self):
        for rec in self:
            metadata_dict = {}
            if rec.metadata:
                if isinstance(rec.metadata, str):
                    try:
                        metadata_dict = ast.literal_eval(rec.metadata)
                    except (ValueError, TypeError):
                        metadata_dict = {}
                else:
                    metadata_dict = rec.metadata

            if metadata_dict and rec.document_type == 'qa':
                rec.answer = metadata_dict.get('answer') or ''
            else:
                rec.answer = ''

    @api.model
    def sync_from_hashy(self):
        config = self.env['aiagentconfig'].sudo().search([('use_config', '=', True)], limit=1)

        if not config:
            raise ValidationError(_("No active AI configuration found"))

        from ..services import HashyAPIService

        service = HashyAPIService(config)

        try:
            response = service.get_knowledge_documents()

            if not response.get('status'):
                raise ValidationError(_("Failed to fetch knowledge documents"))

            documents = response.get('data', [])

            existing_ids = {rec.external_id: rec for rec in self.sudo().search([]) if rec.external_id}

            for doc in documents:
                doc_id = doc.get('id')
                vals = {
                    'external_id': doc_id,
                    'name': doc.get('title'),
                    'title': doc.get('title'),
                    'content': doc.get('content'),
                    'document_type': doc.get('document_type'),
                    'source_url': doc.get('source_url'),
                    'odoo_service_id': doc.get('odoo_service_id'),
                    'user_id': doc.get('user_id'),
                    'metadata': doc.get('metadata', {}),
                    'vector_ids': doc.get('vector_ids', []),
                    'status': doc.get('status', 'active'),
                    'created_at': doc.get('created_at'),
                    'updated_at': doc.get('updated_at'),
                }

                if doc_id in existing_ids:
                    existing_ids[doc_id].sudo().write(vals)
                    del existing_ids[doc_id]
                else:
                    self.sudo().create(vals)

            for remaining_rec in existing_ids.values():
                remaining_rec.sudo().unlink()

            return True

        except Exception as e:
            raise ValidationError(_(f"Error syncing knowledge: {str(e)}"))

    def action_preview_file(self):
        self.ensure_one()

        if self.document_type != 'file' or not self.source_url:
            raise ValidationError(_("No file available for preview"))

        config = self.env['aiagentconfig'].sudo().search([('use_config', '=', True)], limit=1)

        if not config:
            raise ValidationError(_("No active AI configuration"))

        file_path = self.source_url.replace('/public', '')
        base_host = config.base_url.replace('/api/v1', '')
        full_url = f"{base_host}{file_path}"

        return {'name': 'Preview File', 'type': 'actions.act_url', 'url': full_url, 'target': 'popup'}

    def unlink(self):
        config = self.env['aiagentconfig'].sudo().search([('use_config', '=', True)], limit=1)

        if config:
            from ..services import HashyAPIService

            service = HashyAPIService(config)

            for record in self:
                if record.external_id:
                    try:
                        service.delete_knowledge_document(record.external_id)
                    except Exception as e:
                        _logger.warning(
                            f"Failed to delete knowledge document {record.external_id} from server: {str(e)}"
                        )

        return super(AIKnowledge, self).unlink()
