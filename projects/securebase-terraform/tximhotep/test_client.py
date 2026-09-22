import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Use uv run with --with fastmcp so the server environment has its dependencies
    server_params = StdioServerParameters(
        command="python",
        args=["server.py"],
        env=None
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("Successfully connected to SecureBase CEO MCP server!\n")

            tools = await session.list_tools()
            print(f"Discovered Tools: {[t.name for t in tools.tools]}")

            print("\nInvoking tool: run_ffiec_compliance_pipeline...")
            result = await session.call_tool(
                "run_ffiec_compliance_pipeline",
                arguments={
                    "client_identifier": "citizens-national-bank",
                    "aws_region": "us-east-1"
                }
            )
            
            print("\nPipeline Execution Result:")
            for content in result.content:
                print(content.text)

if __name__ == "__main__":
    asyncio.run(main())
