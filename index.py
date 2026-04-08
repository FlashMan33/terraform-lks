import json
import os
import boto3
from botocore.exceptions import ClientError

s3 = boto3.client("s3")
BUCKET = os.environ["DATA_BUCKET"]
KEY = os.environ["DATA_KEY"]


def load_users():
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=KEY)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except ClientError as e:
        if e.response["Error"]["Code"] in ["NoSuchKey", "NoSuchBucket"]:
            return []
        raise


def save_users(users):
    s3.put_object(
        Bucket=BUCKET,
        Key=KEY,
        Body=json.dumps(users).encode("utf-8"),
        ContentType="application/json",
    )


def response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("id")
    users = load_users()

    if method == "GET" and not user_id:
        return response(200, users)

    if method == "GET" and user_id:
        user = next((u for u in users if str(u["id"]) == str(user_id)), None)
        return response(200, user) if user else response(404, {"message": "User not found"})

    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        if not body.get("name") or not body.get("email"):
            return response(400, {"message": "name and email are required"})
        next_id = max([u["id"] for u in users], default=0) + 1
        new_user = {"id": next_id, "name": body["name"], "email": body["email"]}
        users.append(new_user)
        save_users(users)
        return response(201, new_user)

    if method == "PUT" and user_id:
        body = json.loads(event.get("body") or "{}")
        for user in users:
            if str(user["id"]) == str(user_id):
                user["name"] = body.get("name", user["name"])
                user["email"] = body.get("email", user["email"])
                save_users(users)
                return response(200, user)
        return response(404, {"message": "User not found"})

    if method == "DELETE" and user_id:
        filtered = [u for u in users if str(u["id"]) != str(user_id)]
        if len(filtered) == len(users):
            return response(404, {"message": "User not found"})
        save_users(filtered)
        return response(200, {"id": int(user_id), "deleted": True})

    return response(405, {"message": "Method not allowed"})
