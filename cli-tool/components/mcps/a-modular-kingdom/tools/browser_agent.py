import asyncio
import json
from typing import Dict, Any
import nest_asyncio

nest_asyncio.apply()

from browser_use import Agent
from browser_use.llm import ChatOllama


class BrowserUseAgent:
    def __init__(self, llm_model: str = "qwen3:4b"):
        self.llm = ChatOllama(model=llm_model)

    async def perform_browser_task(self, task: str, headless: bool = True) -> Dict[str, Any]:
        try:
            agent = Agent(
                task=task,
                llm=self.llm,
                headless=headless,
            )
            result = await agent.run()
            return {
                "status": "success",
                "task": task,
                "result": str(result),
                "message": "Browser task completed successfully",
            }
        except Exception as e:
            return {
                "status": "error",
                "task": task,
                "result": None,
                "error": str(e),
                "message": f"Browser task failed: {str(e)}",
            }


async def browse_web(task: str, headless: bool = True) -> str:
    agent = BrowserUseAgent()
    result = await agent.perform_browser_task(task, headless)
    return json.dumps(result, indent=2)


