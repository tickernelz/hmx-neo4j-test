import json
import logging
from datetime import datetime

from django.http import HttpRequest
from hmx_api.api import auth
from hmx_api.registry import register_routers
from hmx_api.rpc import clean_save_values, make_json_safe
from ninja import Router, Schema


_logger = logging.getLogger(__name__)

router = Router(tags=["reports"])


class ReportCreateSchema(Schema):
    name: str | None = None
    report_type: str = 'pdf'
    model_id: int | None = None
    is_template: bool = False
    template_id: int | None = None
    template_html: str | None = None
    template_json: dict | None = None
    paper_format_id: int | None = None
    print_report_name: str | None = None
    filter_domain: list = []


class ReportUpdateSchema(Schema):
    name: str | None = None
    report_type: str | None = None
    model_id: int | None = None
    template_html: str | None = None
    template_json: dict | None = None
    paper_format_id: int | None = None
    print_report_name: str | None = None
    filter_domain: list | None = None


class ReportDetailSchema(Schema):
    id: int
    name: str | None = None
    report_type: str
    model_id: int | None = None
    model_name: str | None = None
    is_template: bool
    template_id: int | None = None
    template_html: str | None = None
    template_json: dict | None = None
    paper_format_id: int | None = None
    paper_format_name: str | None = None
    print_report_name: str | None = None
    print_report_preview: str | None = None
    filter_domain: list = []
    created_at: str | None = None
    updated_at: str | None = None
    created_by: int | None = None
    created_by_name: str | None = None
    action_id: int | None = None
    action_name: str | None = None
    is_hashy: bool = False


class ReportResponseSchema(Schema):
    success: bool
    data: ReportDetailSchema


class ReportListResponseSchema(Schema):
    success: bool
    data: list[ReportDetailSchema]
    total: int
    limit: int
    offset: int


class ErrorSchema(Schema):
    success: bool = False
    error: str


def serialize_report(report, include_related=True):
    filter_domain = report.filter_domain or []
    if isinstance(filter_domain, str):
        try:
            filter_domain = json.loads(filter_domain)
        except Exception:
            filter_domain = []

    template_json = report.template_json
    if isinstance(template_json, str):
        try:
            template_json = json.loads(template_json)
        except Exception:
            template_json = None

    data = {
        'id': report.id,
        'name': report.name,
        'report_type': report.report_type,
        'model_id': report.model.id if report.model else None,
        'is_template': report.is_template,
        'template_id': report.template_id.id if report.template_id else None,
        'template_html': report.template_html,
        'template_json': template_json,
        'paper_format_id': report.paper_format.id if report.paper_format else None,
        'print_report_name': report.print_report_name,
        'filter_domain': filter_domain,
        'created_at': report.created_at.isoformat() if hasattr(report, 'created_at') and report.created_at else None,
        'updated_at': report.updated_at.isoformat() if hasattr(report, 'updated_at') and report.updated_at else None,
        'created_by': report.created_by.id if hasattr(report, 'created_by') and report.created_by else None,
        'created_by_name': report.created_by.name if hasattr(report, 'created_by') and report.created_by else None,
        'is_hashy': report.is_hashy if hasattr(report, 'is_hashy') else False,
    }

    if include_related:
        data['model_name'] = report.model.model_name if report.model else None
        data['paper_format_name'] = report.paper_format.name if report.paper_format else None
        data['print_report_preview'] = report.print_report_preview.url if report.print_report_preview else None

        data['action_id'] = report.action_id.id if report.action_id else None
        data['action_name'] = report.action_id.name if report.action_id else None

    return make_json_safe(data)


def validate_report_data(data, is_update=False):
    errors = []

    if not data.get('is_template') and not data.get('model'):
        errors.append("Non-template reports must have a model")

    if data.get('report_type') == 'pdf' and not data.get('template_html'):
        errors.append("PDF reports must have template_html")

    if data.get('report_type') == 'xlsx' and not data.get('template_json'):
        errors.append("Excel reports must have template_json")

    return errors


def build_report_domain(
    model_id=None,
    report_type=None,
    is_template=None,
    name=None,
    created_by=None,
    date_from=None,
    date_to=None,
    custom_domain=None,
):
    domain = []

    if model_id:
        domain.append(('model', '=', model_id))
    if report_type:
        domain.append(('report_type', '=', report_type))
    if is_template is not None:
        domain.append(('is_template', '=', is_template))
    if name:
        domain.append(('name', 'ilike', name))
    if created_by:
        domain.append(('created_by', '=', created_by))
    if date_from:
        try:
            date_from_parsed = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            domain.append(('created_at', '>=', date_from_parsed))
        except (ValueError, AttributeError):
            pass
    if date_to:
        try:
            date_to_parsed = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            domain.append(('created_at', '<=', date_to_parsed))
        except (ValueError, AttributeError):
            pass

    if custom_domain:
        domain.extend(custom_domain)

    return domain


def _create_report_action(env, report):
    if not report.model:
        _logger.warning(f"Cannot create action for report {report.id}: no model assigned")
        return None

    action_name = f"Generate {report.name}" if report.name else "Generate PDF Report"
    action_code = f"env['basereport'].browse({report.id}).action_pdf_data(records)"

    action_vals = {
        'name': action_name,
        'binding_type': 'report',
        'binding_model': report.model.id,
        'model': report.model.id,
        'state': 'code',
        'code': action_code,
    }

    try:
        action = env['baseactionreport'].sudo().create(action_vals)
        report.sudo().write({'action_id': action.id})
        _logger.info(f"Created action {action.id} for report {report.id}")
        return action
    except Exception:
        _logger.exception(f"Failed to create action for report {report.id}")
        return None


@router.post("/reports", auth=auth, response={200: ReportResponseSchema, 400: ErrorSchema})
def create_report(request: HttpRequest, data: ReportCreateSchema):
    try:
        values = data.dict(exclude_unset=True)

        if 'model_id' in values:
            values['model'] = values.pop('model_id')
        if 'paper_format_id' in values:
            values['paper_format'] = values.pop('paper_format_id')
        if 'template_id' in values:
            values['template_id'] = values['template_id']

        values = clean_save_values(values)

        values['is_hashy'] = True

        errors = validate_report_data(values)
        if errors:
            return 400, {"success": False, "error": "; ".join(errors)}

        report = request.env['basereport'].sudo().create(values)

        if report.model and not report.is_template:
            _create_report_action(request.env, report)

        return 200, {"success": True, "data": serialize_report(report)}
    except Exception as e:
        _logger.exception("Failed to create report")
        return 400, {"success": False, "error": str(e)}


@router.get("/reports", auth=auth, response={200: ReportListResponseSchema, 400: ErrorSchema})
def list_reports(
    request: HttpRequest,
    model_id: int | None = None,
    report_type: str | None = None,
    is_template: bool | None = None,
    name: str | None = None,
    created_by: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    domain: str | None = None,
    limit: int = 10,
    offset: int = 0,
):
    try:
        custom_domain = []
        if domain:
            try:
                custom_domain = json.loads(domain)
            except Exception:
                pass

        search_domain = build_report_domain(
            model_id, report_type, is_template, name, created_by, date_from, date_to, custom_domain
        )

        reports = request.env['basereport'].sudo().search(search_domain, limit=limit, offset=offset)
        total = request.env['basereport'].sudo().search_count(search_domain)

        data = [serialize_report(report) for report in reports]

        return 200, {"success": True, "data": data, "total": total, "limit": limit, "offset": offset}
    except Exception as e:
        _logger.exception("Failed to list reports")
        return 400, {"success": False, "error": str(e)}


@router.get("/reports/{report_id}", auth=auth, response={200: ReportResponseSchema, 400: ErrorSchema, 404: ErrorSchema})
def get_report(request: HttpRequest, report_id: int):
    try:
        report = request.env['basereport'].sudo().browse(report_id)

        if not report.exists():
            return 404, {"success": False, "error": "Report not found"}

        return 200, {"success": True, "data": serialize_report(report)}
    except Exception as e:
        _logger.exception(f"Failed to get report {report_id}")
        return 400, {"success": False, "error": str(e)}


@router.put("/reports/{report_id}", auth=auth, response={200: ReportResponseSchema, 400: ErrorSchema, 404: ErrorSchema})
def update_report(request: HttpRequest, report_id: int, data: ReportUpdateSchema):
    try:
        report = request.env['basereport'].sudo().browse(report_id)

        if not report.exists():
            return 404, {"success": False, "error": "Report not found"}

        values = data.dict(exclude_unset=True)

        if 'model_id' in values:
            values['model'] = values.pop('model_id')
        if 'paper_format_id' in values:
            values['paper_format'] = values.pop('paper_format_id')
        if 'template_id' in values:
            values['template_id'] = values['template_id']

        values = clean_save_values(values)

        if values:
            merged_values = {
                'report_type': report.report_type,
                'model': report.model.id if report.model else None,
                'is_template': report.is_template,
                'template_html': report.template_html,
                'template_json': report.template_json,
            }
            merged_values.update(values)

            errors = validate_report_data(merged_values, is_update=True)
            if errors:
                return 400, {"success": False, "error": "; ".join(errors)}

            report.write(values)

        return 200, {"success": True, "data": serialize_report(report)}
    except Exception as e:
        _logger.exception(f"Failed to update report {report_id}")
        return 400, {"success": False, "error": str(e)}


@router.delete("/reports/{report_id}", auth=auth, response={200: dict, 404: ErrorSchema, 400: ErrorSchema})
def delete_report(request: HttpRequest, report_id: int):
    try:
        report = request.env['basereport'].sudo().browse(report_id)

        if not report.exists():
            return 404, {"success": False, "error": "Report not found"}

        report.unlink()

        return 200, {"success": True, "message": "Report deleted successfully"}
    except Exception as e:
        _logger.exception(f"Failed to delete report {report_id}")
        return 400, {"success": False, "error": str(e)}


register_routers([('ai/', router)])
