# Atlas deployment guide

## 1. Create the MongoDB Atlas cluster

1. Sign in to MongoDB Atlas.
2. Create a new cluster.
3. Create a database user with a username and password.
4. Allow network access:
   - For local testing, add your current IP address.
   - For quick testing, allow access from 0.0.0.0/0.
5. Click "Connect" and choose "Drivers".

## 2. Copy the Atlas connection string

Use this format:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
MONGODB_DB=amazon_clone
PORT=3001
```

Example:

```env
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.ab12cd.mongodb.net/amazon_clone?retryWrites=true&w=majority
MONGODB_DB=amazon_clone
PORT=3001
```

## 3. Add the environment variables

Create a file named `.env` in the project root and paste the values above.

## 4. Run the app locally

```bash
npm install
node server.js
```

Then open:

```text
http://localhost:3001
```

## 5. Deploy to a hosting platform

### Render

1. Push the project to GitHub.
2. Create a new Web Service on Render.
3. Connect the GitHub repository.
4. Set the build command:

```bash
npm install
```

5. Set the start command:

```bash
npm start
```

6. Add the same environment variables in Render:
   - MONGODB_URI
   - MONGODB_DB
   - PORT

### Railway

1. Create a new project.
2. Connect the GitHub repo.
3. Add the environment variables above.
4. Deploy.

## 6. Verify the deployment

Open the deployed URL and test the API:

```text
https://your-app-url/api/products
```
