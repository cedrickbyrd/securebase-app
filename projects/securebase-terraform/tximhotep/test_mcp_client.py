import asyncio
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Execute server.py directly with the active venv interpreter
    server_params = StdioServerParameters(
        command=sys.executable,
        args=["server.py"],
        env=None,
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # Discover registered tools
            tools = await session.list_tools()
            tool_names = [tool.name for tool in tools.tools]
            print(f"Discovered Tools: {tool_names}")

            # Run the FFIEC pipeline and output response
            if "run_ffiec_compliance_pipeline" in tool_names:
                print("\nCalling run_ffiec_compliance_pipeline...")
                result = await session.call_tool("run_ffiec_compliance_pipeline", arguments={})
                print("\n--- Pipeline Result ---")
                for content in result.content:
                    print(content.text)

if __name__ == "__main__":
    asyncio.run(main())
