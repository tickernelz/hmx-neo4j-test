from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api


class BaseReport(models.Model):
    class Meta:
        inherit = 'basereport'

    is_hashy = models.BooleanField(
        default=False,
        null=True,
        blank=True,
        verbose_name=_("Is Hashy Report"),
        help_text=_("Reports created via API endpoint for automatic cleanup"),
    )

    @api.model
    def cleanup_hashy_reports(self, days=3):
        import logging
        from datetime import timedelta

        from django.utils import timezone

        _logger = logging.getLogger(__name__)

        cutoff_date = timezone.now() - timedelta(days=days)
        old_reports = self.search([('is_hashy', '=', True), ('created_at', '<', cutoff_date)])

        if old_reports:
            count = len(old_reports)
            _logger.info(f"Cleaning up {count} hashy reports older than {days} days")
            old_reports.unlink()
            _logger.info(f"Successfully deleted {count} hashy reports")
        else:
            _logger.info("No hashy reports to cleanup")

        return True
