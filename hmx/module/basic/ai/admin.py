from django.contrib import admin

from ai.models.ai_agent_config import AIAgentConfig
from ai.models.ai_message import AIMessage
from ai.models.ai_session import AISession


admin.site.register(AIAgentConfig)
admin.site.register(AIMessage)
admin.site.register(AISession)
