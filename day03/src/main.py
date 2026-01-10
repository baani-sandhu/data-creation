from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from middlewares.cors import add_cors_middleware
from routes import authRoute,userRoute

from controllers.crudController import create_user, get_users, get_user_by_email, delete_user


app=FastAPI()
add_cors_middleware(app)

app.include_router(authRoute.router)
app.include_router(userRoute.router)

app.get("/")
async def root():
    return {"Homepage":""}

