from django.db import models
from django.utils.translation import gettext_lazy as _


class AIMessage(models.Model):
    class Meta:
        ordering = ["created_at"]
        verbose_name = _("AI Message")

    MESSAGE_TYPE_CHOICES = [
        ('user', 'User Message'),
        ('ai', 'AI Response'),
    ]

    name = models.CharField(_("Name"), max_length=50)
    text = models.TextField(_("Message Text"))
    message_type = models.CharField(_("Message Type"), max_length=10, choices=MESSAGE_TYPE_CHOICES)
    session_id = models.ForeignKey(
        "ai.AISession", verbose_name=_("AI Session"), on_delete=models.CASCADE, related_name="messages"
    )
    attachment = models.FileField(_("Attachment"), upload_to='documents/', null=True, blank=True, multi=True)
    external_message_id = models.CharField(_("External Message ID"), max_length=255, null=True, blank=True)
    context_mentioned = models.TextField(_("Context Mentioned"), null=True, blank=True)

    def action_view_quick(self):
        return {
            "name": "AI Message Quick",
            "type": "actions.act_window",
            "res_model": "aimessage",
            "view_mode": "quick",
            "views": [(self.env.ref("ai.view_ai_message_quick").id, "quick")],
            "target": "new",
            "context": {"create": False, "edit": False},
        }
