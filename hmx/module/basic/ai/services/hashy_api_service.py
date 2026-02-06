import base64
import json
import mimetypes

import requests


class HashyAPIService:
    def __init__(self, config):
        self.config = config
        self.base_url = config.base_url or "https://hashyai.hashmicro.com/api/v1"
        self.token = config.token

    def _get_headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _parse_error_response(self, response):
        try:
            error_data = response.json()
            if isinstance(error_data, dict):
                if 'message' in error_data:
                    return error_data['message']
                elif 'detail' in error_data:
                    return error_data['detail']
                elif 'error' in error_data:
                    error_info = error_data['error']
                    if isinstance(error_info, dict) and 'details' in error_info:
                        return error_info.get('details', str(error_info))
                    return str(error_info)
                else:
                    return json.dumps(error_data)
            return str(error_data)
        except (ValueError, json.JSONDecodeError):
            return response.text or f"HTTP {response.status_code} Error"

    def _is_token_expired_error(self, error_msg):
        error_indicators = [
            'invalid or expired token',
            'token expired',
            'invalid token',
            'unauthorized',
            'forbidden',
            'authentication failed',
        ]
        return any(indicator in error_msg.lower() for indicator in error_indicators)

    def _try_refresh_token(self):
        try:
            if hasattr(self.config, 'refreshtoken') and self.config.refreshtoken:
                refresh_result = self.config.refresh_token()
                if refresh_result.get('success'):
                    self.token = self.config.token
                    return True
            return False
        except Exception:
            return False

    def _make_request(self, method, endpoint, data=None, timeout=300, retry_count=0):
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=data, timeout=timeout)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=timeout)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            else:
                response = requests.post(url, headers=headers, json=data, timeout=timeout)

            if response.status_code == 200:
                return response.json()
            elif response.status_code in [401, 403] and retry_count == 0:
                error_msg = self._parse_error_response(response)
                if self._is_token_expired_error(error_msg):
                    if self._try_refresh_token():
                        return self._make_request(method, endpoint, data, timeout, retry_count + 1)
                    else:
                        raise TokenRefreshFailedError("Token refresh failed. Please update your token manually.")
                raise APIError(f"API error ({response.status_code}): {error_msg}")
            else:
                error_msg = self._parse_error_response(response)
                raise APIError(f"API error ({response.status_code}): {error_msg}")

        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response is not None:
                error_msg = self._parse_error_response(e.response)
                raise APIError(f"Request failed: {error_msg}")
            raise APIError(f"Request failed: {str(e)}")

    def send_message(
        self,
        prompt,
        name="HMX User",
        phone_number=None,
        session_id=None,
        context=None,
        context_mentioned=None,
        request_env=None,
        files=None,
    ):
        if not phone_number:
            raise APIError("Phone number is required for sending messages")

        endpoint = "/meta/odoo/chat"
        data = {"name": name, "phoneNumber": phone_number, "text": prompt}

        if session_id:
            data["sessionId"] = session_id

        if context_mentioned:
            data["context_mentioned"] = context_mentioned

        if context and not session_id:
            try:
                enriched_context = self._enrich_context(context, request_env)
                data["context"] = enriched_context
            except Exception:
                data["context"] = context

        if files and len(files) > 0:
            first_file = files[0]
            file_content = first_file.get('content')
            if isinstance(file_content, bytes):
                base64_content = base64.b64encode(file_content).decode('utf-8')
                data["filename"] = first_file['filename']
                data["content"] = base64_content

        response = self._make_request("POST", endpoint, data)
        return response

    def _enrich_context(self, context, request_env=None):
        try:
            if not request_env:
                return context

            enriched = dict(context)
            view_data = context.get('active_page_context', {}).get('view_data', {})

            if not view_data.get('model'):
                return enriched

            model_name = view_data['model']
            view_type = view_data.get('view_type', 'unknown')

            if view_type == 'list':
                enriched['active_page_context']['view_data'].update(
                    self._get_list_summary(request_env, model_name, view_data)
                )
            elif view_type == 'form':
                enriched['active_page_context']['view_data'].update(
                    self._get_form_summary(request_env, model_name, view_data)
                )
            elif view_type == 'kanban':
                enriched['active_page_context']['view_data'].update(
                    self._get_kanban_summary(request_env, model_name, view_data)
                )

            return enriched
        except Exception:
            return context

    def _get_list_summary(self, env, model_name, view_data):
        records_ids = view_data.get('records_ids', [])
        selected_ids = view_data.get('selected_record_ids', [])

        summary = {}

        if records_ids:
            records = env[model_name].sudo().browse(records_ids[:10])
            summary['records_summary'] = [
                {'id': r.id, 'display_name': getattr(r, 'display_name', None) or getattr(r, 'name', str(r))}
                for r in records
                if r.exists()
            ]

        if selected_ids:
            selected_records = env[model_name].sudo().browse(selected_ids)
            summary['selected_summary'] = [
                {'id': r.id, 'display_name': getattr(r, 'display_name', None) or getattr(r, 'name', str(r))}
                for r in selected_records
                if r.exists()
            ]

        summary['total_records'] = len(records_ids)
        summary['selected_count'] = len(selected_ids)

        return summary

    def _get_form_summary(self, env, model_name, view_data):
        active_id = view_data.get('active_id')

        if not active_id:
            return {'is_new_record': True}

        record = env[model_name].sudo().browse(active_id)

        if not record.exists():
            return {'record_not_found': True}

        fields_data = {}
        record_data = record.read()[0] if record else {}

        for field_name, value in record_data.items():
            if not field_name.endswith('_display') and value is not None:
                fields_data[field_name] = {'value': str(value), 'type': type(value).__name__}

        return {
            'record_summary': {
                'id': record.id,
                'display_name': getattr(record, 'display_name', None) or getattr(record, 'name', str(record)),
            },
            'fields_summary': fields_data,
            'field_count': len(fields_data),
        }

    def _get_kanban_summary(self, env, model_name, view_data):
        records_ids = view_data.get('records_ids', [])
        needs_backend_fetch = view_data.get('needs_backend_fetch', False)

        if needs_backend_fetch or not records_ids:
            domain = view_data.get('domain', [])
            context = view_data.get('context', {})
            limit = min(view_data.get('limit', 10), 20)

            try:
                if isinstance(domain, str):
                    domain = self._parse_domain_string(domain, env)

                Model = env[model_name].sudo().with_context(context)
                records = Model.search(domain, limit=limit)
                total_count = Model.search_count(domain)

                return {
                    'records_summary': [
                        {'id': r.id, 'display_name': getattr(r, 'display_name', None) or getattr(r, 'name', str(r))}
                        for r in records
                        if r.exists()
                    ],
                    'total_records': total_count,
                    'fetched_from_backend': True,
                }
            except Exception as e:
                return {'records_count': 0, 'error': str(e)}

        if records_ids:
            records = env[model_name].sudo().browse(records_ids[:10])
            return {
                'records_summary': [
                    {'id': r.id, 'display_name': getattr(r, 'display_name', None) or getattr(r, 'name', str(r))}
                    for r in records
                    if r.exists()
                ],
                'total_records': len(records_ids),
            }

        return {'records_count': 0}

    def _parse_domain_string(self, domain_str, env):
        try:
            domain_str = domain_str.strip()
            if not domain_str.startswith('['):
                return []

            domain_str = domain_str.replace('uid', str(env.user.id))

            import ast

            return ast.literal_eval(domain_str)
        except Exception:
            return []

    def get_session_list(self, external_employee_id, status="active"):
        endpoint = "/session"
        params = {"employee_id": external_employee_id, "status": status}

        response = self._make_request("GET", endpoint, params)
        return response

    def authenticate(self, email, password):
        endpoint = "/auth/login"
        data = {"email": email, "password": password}

        response = self._make_request("POST", endpoint, data)
        if response.get('status') and response.get('data', {}).get('token'):
            self.token = response['data']['token']
        return response

    def refresh_token(self, refresh_token):
        endpoint = "/auth/refresh"
        data = {"refreshToken": refresh_token}

        response = self._make_request("POST", endpoint, data)
        if response.get('status') and (
            response.get('data', {}).get('accessToken') or response.get('data', {}).get('refreshToken')
        ):
            self.token = response['data']['accessToken']
        return response

    def is_token_valid(self):
        if not self.token:
            return False

        try:
            test_endpoint = "/auth/validate"
            self._make_request("GET", test_endpoint)
            return True
        except Exception:
            return False

    def get_session_detail(self, session_id):
        endpoint = f"/session/{session_id}"

        response = self._make_request("GET", endpoint)
        return response

    def get_message_history(self, session_id, page=1, limit=50):
        endpoint = "/message"
        params = {"session_id": session_id, "page": page, "limit": limit, "sort_by": "id", "order": "ASC"}

        response = self._make_request("GET", endpoint, params)
        return response

    def sync_ai_rules(self, rules_content):
        endpoint = "/odoo-service/my-ai-rules"
        data = {"ai_rules": rules_content if rules_content else ""}

        response = self._make_request("PUT", endpoint, data)
        return response

    def get_knowledge_documents(self):
        endpoint = "/ai/knowledge/documents"
        response = self._make_request("GET", endpoint)
        return response

    def create_knowledge_text(self, title, content, document_type='text', metadata=None):
        endpoint = "/ai/knowledge/documents"
        data = {"title": title, "content": content, "document_type": document_type}
        if metadata:
            data["metadata"] = metadata
        response = self._make_request("POST", endpoint, data)
        return response

    def create_knowledge_file(self, file_content, filename, title, metadata=None):
        endpoint = "/ai/knowledge/upload"
        url = f"{self.base_url}{endpoint}"

        headers = {
            "Authorization": f"Bearer {self.token}",
        }

        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            mime_type = 'application/octet-stream'

        files = {'file': (filename, file_content, mime_type)}
        data = {'title': title}
        if metadata:
            data['metadata'] = json.dumps(metadata)

        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=300)

            if response.status_code == 200:
                return response.json()
            elif response.status_code in [401, 403]:
                if self._try_refresh_token():
                    headers["Authorization"] = f"Bearer {self.token}"
                    response = requests.post(url, headers=headers, files=files, data=data, timeout=300)
                    if response.status_code == 200:
                        return response.json()
                raise TokenRefreshFailedError("Token refresh failed")
            else:
                error_msg = self._parse_error_response(response)
                raise APIError(f"API error ({response.status_code}): {error_msg}")

        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response is not None:
                error_msg = self._parse_error_response(e.response)
                raise APIError(f"Request failed: {error_msg}")
            raise APIError(f"Request failed: {str(e)}")

    def delete_knowledge_document(self, document_id):
        endpoint = f"/ai/knowledge/documents/{document_id}"
        response = self._make_request("DELETE", endpoint)
        return response


class APIError(Exception):
    pass


class TokenRefreshFailedError(APIError):
    pass
