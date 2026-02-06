from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api


class AISession(models.Model):
    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("AI Session")

    AI_SESSION_STATE = [
        ('draft', 'Draft'),
        ('started', 'Started'),
        ('ended', 'Ended'),
        ('active', 'Active'),
    ]

    @api.model
    def default_user_id(self):
        return self.env.user.id

    name = models.CharField(_("Name"), max_length=50)
    config_id = models.ForeignKey("ai.AIAgentConfig", verbose_name=_("AI Config"), on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=AI_SESSION_STATE, default="draft")
    user_id = models.ForeignKey(
        "auth.User",
        verbose_name=_("User"),
        on_delete=models.CASCADE,
        related_name="ai_session_user_id",
        default=default_user_id,
        domain="[('last_name', 'ilike', 'admin')]",
    )
    external_session_id = models.CharField(_("External Session ID"), max_length=255, null=True, blank=True)
    external_employee_id = models.IntegerField(_("External Employee ID"), null=True, blank=True)

    def action_view_quick(self):
        return {
            "name": "AI Session Quick",
            "type": "actions.act_window",
            "res_model": "aisession",
            "view_mode": "quick",
            "views": [(self.env.ref("ai.view_ai_session_quick").id, "quick")],
            "target": "new",
            "context": {"create": False, "edit": False},
        }
