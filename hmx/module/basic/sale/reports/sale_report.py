from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api, tools
from hmx.tasks import (
    generate_pivot_export_task,
    generate_pivot_report_xlsx_task,
    generate_pivot_spreadsheet_task,
    generate_pivot_spreadsheet_task_v2,
)
from hmx.tools.celery import require_celery_worker, use_task


class SaleReport(models.Model):
    class Meta:
        auto = False
        name = 'salereport'
        verbose_name = 'Sale Anlysis Report'
        verbose_name_plural = 'Sale Anlysis Reports'
        inherit = ['basepivotexport']

    sale = models.ForeignKey("sale.sale", verbose_name=_("Sale"), on_delete=models.CASCADE, null=True)
    product = models.ForeignKey("product.products", verbose_name=_("Product"), on_delete=models.CASCADE, null=True)
    partner = models.ForeignKey("partners.partner", verbose_name=_("Partner"), on_delete=models.CASCADE, null=True)
    quantity = models.FloatField(blank=True, null=True, verbose_name=_("Total Quantity"))
    amount = models.FloatField(blank=True, null=True, verbose_name=_("Total Amount"))

    @api.model
    def _query(self):
        return """
            SELECT
                line.id,
                line.sale_id_id AS sale_id,
                line.product_id_id AS product_id,
                so.partner_id_id AS partner_id,
                line.quantity AS quantity,
                line.subtotal AS amount
            FROM
                sale_saleorderline line
            LEFT JOIN
                sale_sale so ON (so.id = line.sale_id_id)
        """

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""CREATE or REPLACE VIEW %s AS (%s)""" % (self._table, self._query()))

    @use_task(name='Export pivot table', fallback_to_sync=False)
    def action_export_pivot_table(self, vals):
        task = generate_pivot_export_task.delay(vals)
        return {'task_id': task.id}

    @require_celery_worker
    def action_generate_pivot_xlsx(self, vals):
        task = generate_pivot_report_xlsx_task.delay(vals)
        return {
            "success": True,
            "name": "Open static report",
            "type": "static",
            "task_id": task.id,
            "message": "Static report task started",
        }

    @require_celery_worker
    def action_generate_pivot_spreadsheet(self, vals):
        task = generate_pivot_spreadsheet_task.delay(vals)
        return {
            "success": True,
            "name": "Open spreadsheet pivot table",
            "type": "spreadsheet",
            "task_id": task.id,
            "message": "Open spreadsheet task started",
        }

    @require_celery_worker
    def action_generate_pivot_spreadsheet_v2(self, vals):
        task = generate_pivot_spreadsheet_task_v2.delay(vals)
        return {
            "success": True,
            "name": "Open spreadsheet pivot table",
            "type": "spreadsheet",
            "task_id": task.id,
            "message": "Open spreadsheet task started",
        }
