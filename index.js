const express = require('express')
const app = express()
const cors=require("cors")
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000

const admin = require("firebase-admin");

const serviceAccount = require("./style-decor-client-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});




//middleware
app.use(express.json())
app.use(cors())

const verifyToken=async (req,res,next)=>{
  //console.log("headers token", req.headers.authorization)
  const token=req.headers.authorization;
  if (!token){
    return res.status(401).send({message:"Unauthorized access"})
  }
  try{
    const idToken=token.split(" ")[1]
    //console.log(idToken)
  const decoded=await admin.auth().verifyIdToken(idToken)
  //console.log(decoded)
  req.decodedEmail=decoded.email

  next();

  }
  catch(err){
     return res.status(401).send({message:"Unauthorized access"})

  }
  
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5w0kzva.mongodb.net/?appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const dB = client.db("style_decor_db");
    const usersCollection = dB.collection("users");
    const servicesCollection = dB.collection("services");



    //middleware for admin access
     const verifyAdmin=async(req,res,next)=>{
      const email=req.decodedEmail;
      const query={email}

      const user=await usersCollection.findOne(query)

      if (!user || user.role!=="admin"){
        return res.status(403).send({message:"Forbidden Access"})
      }

     
      next()
     }


    //user related apis

    //user data post api
    app.post("/users",async(req,res)=>{
    const user=req.body;
    user.role="user"
    user.createdAt=new Date()
    const email=user.email

    console.log("Received user:", user);   // ← add this
  console.log("Photo URL:", user.photoURL); // ← add this



    const userExists=await usersCollection.findOne({email})
    if (userExists){
      return res.send({message:"User already exist"})
    }
    const result=await usersCollection.insertOne(user);
    res.send(result)
   })

   //user role get
   app.get("/users/:email/role",async(req,res)=>{
    const email=req.params.email;
    const query={email:email}
    const user=await usersCollection.findOne(query)
    res.send({role: user?.role || "user"})

   })
    //get all the users
   app.get("/users",verifyToken,async(req,res)=>{
    const searchText=req.query.searchText;
    const query={}
    if (searchText){
      query.$or=[
        { displayName: { $regex: searchText, $options: "i" } },   // case-insensitive
      { email: { $regex: searchText, $options: "i" } }   // case-insensitive
      ]
    }
    const cursor=await usersCollection.find(query).toArray();
    res.send(cursor)
   })

   // update the user info
   app.patch("/users/:id/role",verifyToken,verifyAdmin,async(req,res)=>{
    const id=req.params.id;
    const query={_id: new ObjectId(id)}
    const role=req.body.role;
    const updated={
      $set:{
        role:role
      }
    }

     const result=await usersCollection.updateOne(query,updated)
     res.send(result)
   })

   app.get('/users/profile', verifyToken, async (req, res) => {

            const email = req.query.email;
            const query = {}
            if (email) {
                query.email = email
            }

            // verify user have access to see this data
            if (email !== req.decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const cursor = usersCollection.find(query)
            const result = await cursor.toArray()
            res.send(result);
        })

     //service related apis

     //post a service
    app.post("/services",verifyToken,verifyAdmin,async(req,res)=>{
      const service=req.body;

      //console.log(service)

      const result = await servicesCollection.insertOne(service);
      res.send(result)
    })



    //get all services api
    app.get("/services",async(req,res)=>{
         const { searchText, type  } = req.query;

  let query = {};

  if (searchText) {
    query.serviceName = { $regex: searchText, $options: "i" }; 
  }

  if (type) {
    query.category = type;
  }
  
  
        result=await servicesCollection.find(query).toArray()
        res.send(result)
    })

    
     
//     //update the info of service
    app.patch("/services/:id", verifyToken,verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const updatedInfo = req.body;

        const query = { _id: new ObjectId(id) };
        const update = { $set: updatedInfo };

        const result = await servicesCollection.updateOne(query, update);
        res.send(result);

    } catch (error) {
        console.log("Error updating service:", error);
    }
});

//delete service
app.delete("/services/:id" ,verifyToken,verifyAdmin,async(req,res)=>{
    const id=req.params.id;
    const query={_id:new ObjectId(id)}
    const result= await servicesCollection.deleteOne(query)
    res.send(result)
   })

    //get one service
    app.get("/services/:id",async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)}
      const result= await servicesCollection.findOne(query);
      res.send(result)
    })











    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})