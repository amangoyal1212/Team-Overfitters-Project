import asyncio
import httpx

async def test():
    url = "https://api.cpicpgx.org/v1/diplotype"
    params = {
        "genesymbol": "eq.CYP2D6",
        "diplotype": "eq.*4/*4"
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=params)
        print("STATUS:", r.status_code)
        print("DATA:", r.json())

asyncio.run(test())