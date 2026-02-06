from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class AIAgentConfig(models.Model):
    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("AI Agent Config")

    AI_STATE = [
        ("draft", "Draft"),
        ("connected", "Connected"),
        ("failed", "Failed"),
    ]

    def default_base_url(self):
        return "https://hashyai.hashmicro.com/api/v1"

    name = models.CharField(_("Configuration Name"), max_length=50, null=True, blank=True)
    email = models.EmailField(_("Email"), max_length=254, unique=True)
    password = models.CharField(_("Password"), max_length=128)
    base_url = models.URLField(_("Base URL"), max_length=200, null=True, blank=True, default=default_base_url)
    token = models.TextField(_("Token"), null=True, blank=True)
    refreshtoken = models.TextField(_("Refresh Token"), null=True, blank=True)
    state = models.CharField(max_length=10, choices=AI_STATE, default='draft', tracking=True)
    response = models.TextField(_("Response"), null=True, blank=True)
    status = models.CharField(max_length=10, choices=AI_STATE, default='draft', tracking=True)
    documents = models.FileField(_("Documents"), upload_to='documents/', null=True, blank=True, multi=True)
    rules = models.TextField(_("AI Rules"), null=True, blank=True)
    use_config = models.BooleanField(_("Main Config"), null=True, blank=True)
    token_expires_at = models.DateTimeField(_("Token Expires At"), null=True, blank=True)
    refresh_token_expires_at = models.DateTimeField(_("Refresh Token Expires At"), null=True, blank=True)

    def authenticate(self):
        try:
            from ..services import HashyAPIService

            service = HashyAPIService(self)
            api_response = service.authenticate(self.email, self.password)

            token = api_response.get('data', {}).get('token') if api_response.get('data') else None
            refresh_token = api_response.get('data', {}).get('refreshToken') if api_response.get('data') else None
            state = 'connected' if api_response.get('status') else 'failed'

            vals = {
                'state': state,
                'status': state,
                'token': token,
                'refreshtoken': refresh_token,
                'response': api_response,
            }

            if token:
                vals.update(
                    {
                        'token_expires_at': timezone.now() + timedelta(hours=1),
                        'refresh_token_expires_at': timezone.now() + timedelta(days=7),
                    }
                )

            self.write(vals)

            if not token:
                return {'success': False, 'message': 'Connection failed', 'data': api_response}

            return {'success': True, 'message': 'Connection success', 'data': api_response}

        except Exception as e:
            self.write({'state': 'failed', 'status': 'failed', 'response': f'Error: {str(e)}'})
            return {'success': False, 'message': 'Connection failed', 'data': f'Error: {str(e)}'}

    def refresh_token(self):
        try:
            from ..services import HashyAPIService

            service = HashyAPIService(self)
            api_response = service.refresh_token(self.refreshtoken)

            token = api_response.get('data', {}).get('accessToken') if api_response.get('data') else None
            refresh_token = api_response.get('data', {}).get('refreshToken') if api_response.get('data') else None
            state = 'connected' if api_response.get('status') else 'failed'

            vals = {
                'state': state,
                'status': state,
                'token': token,
                'refreshtoken': refresh_token,
                'response': api_response,
            }

            if token:
                vals.update({'token_expires_at': timezone.now() + timedelta(hours=1)})

            self.write(vals)

            if not token:
                return {'success': False, 'message': 'Refresh failed', 'data': api_response}

            return {'success': True, 'message': 'Refresh success', 'data': api_response}

        except Exception as e:
            self.write({'state': 'failed', 'status': 'failed', 'response': f'Error: {str(e)}'})
            return {'success': False, 'message': 'Refresh failed', 'data': f'Error: {str(e)}'}

    def auto_refresh_tokens(self):
        now = timezone.now()
        threshold = now + timedelta(minutes=10)

        configs = self.search(
            [
                ('use_config', '=', True),
                ('state', '=', 'connected'),
                ('token_expires_at', '<=', threshold),
                ('refresh_token_expires_at', '>', now),
            ]
        )

        for config in configs:
            try:
                result = config.refresh_token()
                if result.get('success'):
                    config.write({})
                else:
                    config.write({'state': 'failed', 'status': 'failed'})
            except Exception as e:
                config.write({'state': 'failed', 'status': 'failed', 'response': f'Auto refresh error: {str(e)}'})

    def action_view_quick(self):
        return {
            "name": "AI Agent Config Quick",
            "type": "actions.act_window",
            "res_model": "aiagentconfig",
            "view_mode": "quick",
            "views": [(self.env.ref("ai.view_ai_agent_config_quick").id, "quick")],
            "target": "new",
            "context": {"create": False, "edit": False},
        }

    def write(self, vals):
        res = super().write(vals)

        if 'rules' in vals:
            for record in self:
                try:
                    from ..services import HashyAPIService

                    service = HashyAPIService(record)
                    api_response = service.sync_ai_rules(record.rules)
                    super(AIAgentConfig, record).write({'response': api_response})
                except Exception as e:
                    raise Exception(f'Error syncing AI Rules: {str(e)}')

        return res
