import os

from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api
from hmx.exceptions import ValidationError


class AIKnowledgeWizard(models.Model):
    class Meta:
        name = "aiknowledgewizard"
        transient = True
        verbose_name = _("Create Knowledge Base")

    document_type = models.CharField(
        _("Document Type"),
        max_length=10,
        choices=[('text', 'Free Text'), ('qa', 'Q&A'), ('file', 'Upload File')],
        default='text',
    )

    title = models.CharField(_("Title"), max_length=255)

    content = models.TextField(_("Content/Question"), null=True, blank=True, help_text=_("Maximum 65,535 characters"))

    answer = models.TextField(
        _("Answer"), null=True, blank=True, help_text=_("For Q&A type. Maximum 65,535 characters")
    )

    file = models.FileField(
        _("File"),
        upload_to='temp/',
        null=True,
        blank=True,
        help_text=_("Supported: .pdf, .txt, .md, .docx, .doc (Max 10MB)"),
    )

    validation_message = models.TextField(compute="_compute_validation_message", store=False, editable=False)

    @api.depends('document_type', 'content', 'answer', 'file')
    def _compute_validation_message(self):
        from django.core.files.storage import default_storage

        for rec in self:
            errors = []

            if rec.document_type in ['text', 'qa']:
                if rec.content and len(rec.content) > 65535:
                    errors.append(_("Content exceeds 65,535 characters"))

                if rec.document_type == 'qa' and rec.answer and len(rec.answer) > 65535:
                    errors.append(_("Answer exceeds 65,535 characters"))

            elif rec.document_type == 'file' and rec.file:
                file_path = str(rec.file)

                try:
                    if default_storage.exists(file_path):
                        file_size = default_storage.size(file_path)
                        if file_size > 10485760:
                            errors.append(_("File size exceeds 10MB"))
                except Exception:
                    pass

                allowed_exts = ['.pdf', '.txt', '.md', '.docx', '.doc']
                file_ext = os.path.splitext(file_path)[1].lower()
                if file_ext not in allowed_exts:
                    errors.append("File type not supported. Allowed: .pdf, .txt, .md, .docx, .doc")

            rec.validation_message = "\n".join(errors) if errors else False

    def action_create_knowledge(self):
        self.ensure_one()

        if self.validation_message:
            raise ValidationError(self.validation_message)

        config = self.env['aiagentconfig'].sudo().search([('use_config', '=', True)], limit=1)

        if not config:
            raise ValidationError(_("No active AI configuration"))

        from ..services import HashyAPIService

        service = HashyAPIService(config)

        try:
            if self.document_type == 'text':
                service.create_knowledge_text(title=self.title, content=self.content, document_type='text')

            elif self.document_type == 'qa':
                service.create_knowledge_text(
                    title=self.title, content=self.content, document_type='qa', metadata={'answer': self.answer}
                )

            elif self.document_type == 'file':
                if not self.file:
                    raise ValidationError(_("Please upload a file"))

                from django.core.files.storage import default_storage

                file_path = str(self.file)

                if not default_storage.exists(file_path):
                    raise ValidationError(_("File not found"))

                with default_storage.open(file_path, 'rb') as f:
                    file_content = f.read()

                filename = os.path.basename(file_path)

                service.create_knowledge_file(file_content=file_content, filename=filename, title=self.title)

            self.env['aiknowledge'].sudo().sync_from_hashy()

            return True

        except Exception as e:
            raise ValidationError(_(f"Error: {str(e)}"))
