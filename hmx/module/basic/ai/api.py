import json
import os
import re
import traceback
from typing import List

from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.http import FileResponse, HttpRequest
from hmx_api.registry import register_routers
from ninja import Router, Schema
from rest_framework_simplejwt.tokens import RefreshToken

from .services import APIError, HashyAPIService, TokenRefreshFailedError


router = Router(tags=["ai"])


class HashyLoginSchema(Schema):
    phone: str
    secret_key: str


class HashyTokenSchema(Schema):
    access: str
    refresh: str
    user: dict


class HashyErrorSchema(Schema):
    detail: str


class RenameSessionSchema(Schema):
    name: str


class FileAttachmentSchema(Schema):
    filename: str
    content_type: str
    size: int
    url: str = None


class ChatRequestSchema(Schema):
    message: str
    session_id: str = None
    external_employee_id: int = None
    context: dict = None


class ChatResponseSchema(Schema):
    success: bool
    message_id: int
    session_id: str
    response: dict
    external_session_id: str = None
    attachments: List[FileAttachmentSchema] = []


class SessionListSchema(Schema):
    success: bool
    sessions: list
    total: int


class MessageDetailSchema(Schema):
    id: int
    text: str
    message_type: str
    created_at: str
    sender: str
    attachments: List[FileAttachmentSchema] = []
    context_mentioned: str | None = None


class SessionDetailSchema(Schema):
    success: bool
    session: dict
    messages: List[MessageDetailSchema]


def normalize_phone(phone):
    if not phone:
        return None

    clean_phone = re.sub(r'[^\d+]', '', phone)

    if clean_phone.startswith('+'):
        return clean_phone
    elif clean_phone.startswith('0'):
        return '+62' + clean_phone[1:]
    elif clean_phone.startswith('62'):
        return '+' + clean_phone
    else:
        return '+62' + clean_phone


@router.api_operation(["POST"], "/hashy_login", response={200: HashyTokenSchema, 403: HashyErrorSchema})
def hashy_login(request: HttpRequest, data: HashyLoginSchema):
    try:
        config_param = request.env['baseconfigparameter'].sudo().search([('key', '=', 'hashy_secret_key')], limit=1)

        if not config_param or config_param.value != data.secret_key:
            return 403, {"detail": "Invalid credentials"}

        normalized_phone = normalize_phone(data.phone)
        if not normalized_phone:
            return 403, {"detail": "Invalid credentials"}

        hmx_user = (
            request.env['user']
            .sudo()
            .search(
                [
                    '|',
                    '|',
                    '|',
                    ('phone', '=', data.phone),
                    ('mobile', '=', data.phone),
                    ('phone', '=', normalized_phone),
                    ('mobile', '=', normalized_phone),
                ],
                limit=1,
            )
        )

        if not hmx_user:
            return 403, {"detail": "Invalid credentials"}

        try:
            django_user = User.objects.get(id=hmx_user.id)  # hmx-ignore: django-orm
        except User.DoesNotExist:
            return 403, {"detail": "Invalid credentials"}

        refresh = RefreshToken.for_user(django_user)

        user_data = {
            "id": hmx_user.id,
            "username": hmx_user.username,
            "email": hmx_user.email,
            "first_name": hmx_user.first_name,
            "last_name": hmx_user.last_name,
        }

        return 200, {"access": str(refresh.access_token), "refresh": str(refresh), "user": user_data}

    except Exception:
        return 403, {"detail": "Invalid credentials", "traceback": traceback.format_exc()}


@router.api_operation(
    ["POST"],
    "/chat",
    response={200: ChatResponseSchema, 400: HashyErrorSchema, 401: HashyErrorSchema, 403: HashyErrorSchema},
)
def chat_request(request: HttpRequest):
    try:
        user_id = request.user.id

        config = request.env['aiagentconfig'].sudo().search([('use_config', '=', True)], limit=1)
        if not config:
            return 400, {"detail": "AI configuration not found"}

        hashy_service = HashyAPIService(config)

        is_multipart = request.content_type and 'multipart/form-data' in request.content_type

        if is_multipart:
            message_text = request.POST.get('message', '')
            session_id = request.POST.get('session_id', None)
            context_str = request.POST.get('context', None)
            context_mentioned = request.POST.get('context_mentioned', None)

            try:
                context = json.loads(context_str) if context_str else None
            except (json.JSONDecodeError, TypeError):
                context = None

            uploaded_files = request.FILES.getlist('files') if hasattr(request, 'FILES') else []
        else:
            try:
                body = json.loads(request.body.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return 400, {"detail": "Invalid JSON body"}

            message_text = body.get('message', '')
            session_id = body.get('session_id', None)
            context = body.get('context', None)
            context_mentioned = body.get('context_mentioned', None)
            uploaded_files = []

        if not message_text:
            return 400, {"detail": "Message text is required"}

        session = None
        if session_id:
            session = (
                request.env['aisession']
                .sudo()
                .search([('external_session_id', '=', session_id), ('user_id', '=', user_id)], limit=1)
            )

        user = request.env['user'].sudo().browse(user_id)
        user_name = user.name or "HMX User"
        phone_number = getattr(user, 'phone', None) or getattr(user, 'mobile', None)

        if not phone_number:
            return 400, {"detail": "User phone number is required for chat functionality"}

        file_attachments = []
        if uploaded_files:
            for uploaded_file in uploaded_files:
                file_attachments.append(
                    {
                        'filename': uploaded_file.name,
                        'content': uploaded_file.read(),
                        'content_type': uploaded_file.content_type,
                        'size': uploaded_file.size,
                    }
                )

        if not session:
            session_data = hashy_service.send_message(
                message_text,
                name=user_name,
                phone_number=phone_number,
                context=context,
                context_mentioned=context_mentioned,
                request_env=request.env,
                files=file_attachments,
            )

            response_external_employee_id = session_data.get('data', {}).get('employee_id')
            new_external_session_id = session_data.get('data', {}).get('session_id')

            session_vals = {
                'name': f"{message_text[:30]}{'...' if len(message_text) > 30 else ''}",
                'config_id': config.id,
                'status': 'active',
                'user_id': user_id,
                'external_employee_id': response_external_employee_id,
                'external_session_id': new_external_session_id,
            }
            session = request.env['aisession'].sudo().create(session_vals)

            current_external_session_id = new_external_session_id
            response_text = session_data.get('data', {}).get('message', '')
        else:
            current_external_session_id = session.external_session_id
            response_data = hashy_service.send_message(
                message_text,
                name=user_name,
                phone_number=phone_number,
                session_id=current_external_session_id,
                context=context,
                context_mentioned=context_mentioned,
                request_env=request.env,
                files=file_attachments,
            )
            response_text = response_data.get('data', {}).get('message', '')

        user_message_vals = {
            'name': f"{message_text[:30]}{'...' if len(message_text) > 30 else ''}",
            'text': message_text,
            'message_type': 'user',
            'session_id': session.id,
            'context_mentioned': context_mentioned,
        }
        user_message = request.env['aimessage'].sudo().create(user_message_vals)

        if file_attachments:
            file_tuples = [(file_data['filename'], file_data['content']) for file_data in file_attachments]
            user_message.write({'attachment': file_tuples})

        ai_message = (
            request.env['aimessage']
            .sudo()
            .create(
                {
                    'name': f"AI Response {response_text[:30]}...",
                    'text': response_text,
                    'message_type': 'ai',
                    'session_id': session.id,
                }
            )
        )

        attachment_list = []
        if user_message.attachment:
            file_paths = (
                user_message.attachment if isinstance(user_message.attachment, list) else [user_message.attachment]
            )
            for file_path in file_paths:
                filename = os.path.basename(file_path)
                file_size = default_storage.size(file_path) if default_storage.exists(file_path) else 0
                attachment_list.append(
                    {
                        'filename': filename,
                        'content_type': 'application/octet-stream',
                        'size': file_size,
                        'url': default_storage.url(file_path),
                    }
                )

        return 200, {
            "success": True,
            "message_id": ai_message.id,
            "session_id": str(session.id),
            "external_session_id": current_external_session_id,
            "response": {"data": response_text, "session_id": current_external_session_id},
            "attachments": attachment_list,
        }

    except TokenRefreshFailedError as e:
        return 401, {"detail": str(e)}
    except APIError as e:
        return 400, {"detail": str(e)}
    except Exception as e:
        return 400, {"detail": f"Unexpected error: {str(e)}"}


@router.api_operation(
    ["GET"], "/sessions", response={200: SessionListSchema, 400: HashyErrorSchema, 401: HashyErrorSchema}
)
def get_sessions(request: HttpRequest, external_employee_id: int = None, status: str = "active"):
    try:
        user_id = request.user.id

        domain = [('user_id', '=', user_id)]
        if status:
            domain.append(('status', '=', status))
        if external_employee_id:
            domain.append(('external_employee_id', '=', external_employee_id))

        sessions = request.env['aisession'].sudo().search(domain, order='created_at desc')

        session_list = []
        for session in sessions:
            session_data = {
                'id': session.id,
                'name': session.name,
                'status': session.status,
                'external_session_id': session.external_session_id,
                'created_at': session.created_at.isoformat() if session.created_at else None,
                'updated_at': session.updated_at.isoformat() if session.updated_at else None,
                'message_count': len(session.messages.all()),
                'external_employee_id': session.external_employee_id,
            }
            session_list.append(session_data)

        return 200, {"success": True, "sessions": session_list, "total": len(session_list)}

    except APIError as e:
        return 400, {"detail": str(e)}
    except Exception as e:
        return 400, {"detail": f"Unexpected error: {str(e)}"}


@router.api_operation(
    ["GET"], "/sessions/{session_id}", response={200: SessionDetailSchema, 400: HashyErrorSchema, 404: HashyErrorSchema}
)
def get_session_detail(request: HttpRequest, session_id: int):
    try:
        user_id = request.user.id

        session = request.env['aisession'].sudo().search([('id', '=', session_id), ('user_id', '=', user_id)], limit=1)

        if not session:
            return 404, {"detail": "Session not found or access denied"}

        messages = request.env['aimessage'].sudo().search([('session_id', '=', session.id)], order='created_at asc')

        message_list = []
        for message in messages:
            attachments = []
            if message.attachment:
                file_paths = message.attachment if isinstance(message.attachment, list) else [message.attachment]
                for file_path in file_paths:
                    filename = os.path.basename(file_path)
                    file_size = default_storage.size(file_path) if default_storage.exists(file_path) else 0
                    attachments.append(
                        {
                            'filename': filename,
                            'content_type': 'application/octet-stream',
                            'size': file_size,
                            'url': default_storage.url(file_path),
                        }
                    )

            message_data = {
                'id': message.id,
                'text': message.text,
                'message_type': message.message_type,
                'created_at': message.created_at.isoformat() if message.created_at else None,
                'sender': message.message_type,
                'attachments': attachments,
                'context_mentioned': message.context_mentioned if message.context_mentioned else None,
            }
            message_list.append(message_data)

        session_data = {
            'id': session.id,
            'name': session.name,
            'status': session.status,
            'external_session_id': session.external_session_id,
            'created_at': session.created_at.isoformat() if session.created_at else None,
            'updated_at': session.updated_at.isoformat() if session.updated_at else None,
            'external_employee_id': session.external_employee_id,
        }

        return 200, {"success": True, "session": session_data, "messages": message_list}

    except APIError as e:
        return 400, {"detail": str(e)}
    except Exception as e:
        return 400, {"detail": f"Unexpected error: {str(e)}"}


@router.api_operation(
    ["POST"], "/sessions/{session_id}/delete", response={200: dict, 404: HashyErrorSchema, 403: HashyErrorSchema}
)
def delete_session(request: HttpRequest, session_id: int):
    try:
        user_id = request.user.id

        session = request.env['aisession'].sudo().search([('id', '=', session_id), ('user_id', '=', user_id)], limit=1)

        if not session:
            return 404, {"detail": "Session not found or access denied"}

        session.unlink()

        return 200, {"success": True, "message": "Session deleted successfully"}

    except Exception as e:
        return 400, {"detail": f"Error deleting session: {str(e)}"}


@router.api_operation(
    ["POST"], "/sessions/{session_id}/rename", response={200: dict, 404: HashyErrorSchema, 403: HashyErrorSchema}
)
def rename_session(request: HttpRequest, session_id: int, payload: RenameSessionSchema):
    try:
        user_id = request.user.id
        new_name = payload.name.strip()

        if not new_name:
            return 400, {"detail": "Session name is required"}

        session = request.env['aisession'].sudo().search([('id', '=', session_id), ('user_id', '=', user_id)], limit=1)

        if not session:
            return 404, {"detail": "Session not found or access denied"}

        session.write({'name': new_name})

        return 200, {"success": True, "message": "Session renamed successfully"}

    except Exception as e:
        return 400, {"detail": f"Error renaming session: {str(e)}"}


@router.get("/attachments/{message_id}/{filename}")
def download_attachment(request: HttpRequest, message_id: int, filename: str):
    try:
        user_id = request.user.id

        message = request.env['aimessage'].sudo().search([('id', '=', message_id)], limit=1)

        if not message:
            return 404, {"detail": "Message not found"}

        session = message.session_id
        if session.user_id.id != user_id:
            return 403, {"detail": "Access denied"}

        if not message.attachment:
            return 404, {"detail": "No attachments found"}

        file_paths = message.attachment if isinstance(message.attachment, list) else [message.attachment]
        for file_path in file_paths:
            if os.path.basename(file_path) == filename:
                if os.path.exists(file_path):
                    response = FileResponse(open(file_path, 'rb'))
                    response['Content-Disposition'] = f'attachment; filename="{filename}"'
                    response['Content-Type'] = 'application/octet-stream'
                    return response
                else:
                    return 404, {"detail": "File not found on disk"}

        return 404, {"detail": "Attachment not found"}

    except Exception as e:
        return 400, {"detail": f"Error downloading attachment: {str(e)}"}


register_routers([("ai/", router)])
