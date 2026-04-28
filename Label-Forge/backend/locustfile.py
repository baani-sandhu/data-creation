# HOW TO RUN:
# 1. pip install locust
# 2. Get a Firebase ID token for a test user:
#    - Sign in to your app, open DevTools -> Application ->
#      Session Storage -> copy the Firebase token
#    - OR use Firebase Admin SDK to generate one
# 3. Set environment variables:
#    export LOCUST_TEST_TOKEN="your-firebase-id-token"
#    export LOCUST_TEST_JOB_ID="a-real-job-id-from-your-db"
# 4. Run:
#    locust -f locustfile.py --host=http://124.123.18.150/labelforge-api
# 5. Open http://localhost:8089
# 6. Set users=10, spawn rate=2, click Start
#
# RECOMMENDED TEST SCENARIOS:
# - Smoke test: 5 users, 1 spawn rate, 1 minute
# - Load test: 20 users, 5 spawn rate, 5 minutes
# - Stress test: 50 users, 10 spawn rate, until errors appear
#
# WATCH FOR:
# - Response times above 2000ms on GET /jobs/
# - Any 500 errors
# - MongoDB connection pool exhaustion
# - Gemini rate limit 429 errors on /generate

import json
import os
import random

from locust import HttpUser, between, task

TEST_TOKEN = os.getenv("LOCUST_TEST_TOKEN", "")


class LabelForgeUser(HttpUser):
    wait_time = between(1, 3)  # wait 1-3s between tasks
    weight = 10  # 10 regular users for each 1 heavy user

    def on_start(self):
        self.auth_headers = {
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json",
        }

    # READ ENDPOINTS (high frequency)

    @task(5)
    def get_jobs(self):
        self.client.get("/jobs/", headers=self.auth_headers)

    @task(5)
    def get_documents(self):
        self.client.get("/documents/", headers=self.auth_headers)

    @task(5)
    def get_datasets(self):
        self.client.get("/datasets", headers=self.auth_headers)

    @task(3)
    def health_check(self):
        self.client.get("/health")

    # JOB DETAIL ENDPOINTS (medium frequency)

    @task(3)
    def get_job_detail(self):
        # Use a known job_id from environment or skip if not set.
        job_id = os.getenv("LOCUST_TEST_JOB_ID", "")
        if not job_id:
            return
        self.client.get(f"/jobs/{job_id}", headers=self.auth_headers)

    @task(3)
    def get_chunks(self):
        job_id = os.getenv("LOCUST_TEST_JOB_ID", "")
        if not job_id:
            return
        self.client.get(f"/jobs/{job_id}/chunks?limit=50", headers=self.auth_headers)

    @task(2)
    def get_results(self):
        job_id = os.getenv("LOCUST_TEST_JOB_ID", "")
        if not job_id:
            return
        self.client.get(f"/jobs/{job_id}/results", headers=self.auth_headers)

    @task(2)
    def get_results_stats(self):
        job_id = os.getenv("LOCUST_TEST_JOB_ID", "")
        if not job_id:
            return
        self.client.get(f"/jobs/{job_id}/results/stats", headers=self.auth_headers)

    # WRITE ENDPOINTS (low frequency)

    @task(1)
    def refine_prompt(self):
        self.client.post(
            "/prompts/refine",
            headers=self.auth_headers,
            json={"prompt": "Extract question and answer pairs from support documents"},
        )


class HeavyUser(HttpUser):
    wait_time = between(10, 30)
    weight = 1  # 1 heavy user per 10 regular users

    def on_start(self):
        self.auth_headers = {
            "Authorization": f"Bearer {TEST_TOKEN}",
        }

    @task
    def run_generation(self):
        job_id = os.getenv("LOCUST_TEST_JOB_ID", "")
        if not job_id:
            return
        self.client.post(
            f"/jobs/{job_id}/generate",
            headers=self.auth_headers,
            timeout=120,  # generation can take a while
        )
