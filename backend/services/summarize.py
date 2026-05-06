from openai import OpenAI
from config import OPENROUTER_API_KEY

# OpenRouter Client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)

def summarize_text(text):

    response = client.chat.completions.create(
        model="deepseek/deepseek-chat",

        messages=[
            {
                "role": "user",
                "content": f"Summarize this transcript:\n{text}"
            }
        ]
    )

    return response.choices[0].message.content