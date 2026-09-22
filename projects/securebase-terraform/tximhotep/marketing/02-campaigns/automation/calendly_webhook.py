import os
from fastapi import FastAPI, Request, HTTPException
import pandas as pd
from datetime import datetime

app = FastAPI(title="SecureBase GTM Webhook Ingestion")

CSV_PATH = "04-analytics/campaign-metrics.csv"

@app.post("/webhooks/calendly")
async def handle_calendly_webhook(request: Request):
    payload = await request.json()
    event_type = payload.get("event")
    
    if event_type == "invitee.created":
        resource = payload.get("payload", {})
        email = resource.get("email")
        name = resource.get("name")
        event_time = resource.get("start_time", datetime.now().strftime("%Y-%m-%d"))
        
        # Parse date
        date_str = event_time.split("T")[0] if "T" in event_time else event_time
        
        print(f"[Automation] New Audit Booked: {name} ({email}) on {date_str}")
        
        # Append to campaign metrics CSV if exists
        if os.path.exists(CSV_PATH):
            df = pd.read_csv(CSV_PATH)
            new_row = {
                "Date": date_str,
                "Campaign_Name": "Inbound-Calendly-Audit",
                "Target_Segment": "Inbound CISO / CBO",
                "Touchpoint": "Calendly Webhook Auto-Book",
                "Outreach_Sent": 1,
                "Connections_Accepted": 1,
                "Responses_Received": 1,
                "Audits_Booked": 1,
                "Paid_POCs_Closed": 0,
                "AWS_Private_Offers_Sent": 0,
                "Pipeline_Generated_USD": 5000
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            df.to_csv(CSV_PATH, index=False)
            print("[Automation] Updated 04-analytics/campaign-metrics.csv successfully.")
            
        return {"status": "success", "message": "Audit call logged to pipeline."}
    
    return {"status": "ignored", "event": event_type}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
