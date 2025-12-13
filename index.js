const express = require('express')
const app = express()
const cors=require("cors")
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
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
    const bookingsCollection = dB.collection("bookings");
    const paymentCollection = dB.collection("paymentDetails");
    const decoratorsCollection = dB.collection("decoratorsCollection");



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

      //middleware for admin access
     const verifyUser=async(req,res,next)=>{
      const email=req.decodedEmail;
      const query={email}

      const user=await usersCollection.findOne(query)

      if (!user || user.role!=="user"){
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
  
    //bookings related apis

     //post a booking
    app.post("/bookings",verifyToken,async(req,res)=>{
      const service=req.body;

    const result = await bookingsCollection.insertOne(service);
      res.send(result)
    })

    app.get("/bookings",async(req,res)=>{
      const {email}=req.query
      const option={sort:{ bookingDate: 1 }}
      
      query={}
      if (email){
        query.clientEmail=email
      }

      
      const result = await bookingsCollection.find(query,option).toArray();
      res.send(result)
    })

    //delete bookings
  app.delete("/bookings/:id" ,verifyToken,verifyUser,async(req,res)=>{
    const id=req.params.id;
    const query={_id:new ObjectId(id)}
    const result= await bookingsCollection.deleteOne(query)
    res.send(result)
   })
   

   //patch booking details
    app.patch("/bookings/:id", verifyToken,verifyUser, async (req, res) => {
    try {
        const id = req.params.id;
        const updatedInfo = req.body;

        const query = { _id: new ObjectId(id) };
        const update = { $set: updatedInfo };

        const result = await bookingsCollection.updateOne(query, update);
        res.send(result);

    } catch (error) {
        console.log("Error updating booking:", error);
    }
});

//get one booking
    app.get("/bookings/:id",verifyToken,verifyUser,async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)}
      const result= await bookingsCollection.findOne(query);
      res.send(result)
    })


    //decorator related apis
   
    //post decorator
    app.post("/decorators",verifyToken,verifyAdmin,async(req,res)=>{
    const decorator=req.body;
    decorator.approveStatus="pending"
    decorator.createdAt=new Date()


    const exists = await decoratorsCollection.findOne({
    userId: decorator.userId,
  });

  if (exists) {
    return res.send({ message: "Decorator already created" });
  }
   
    
    const result=await decoratorsCollection.insertOne(decorator);
    res.send(result)
   })

  
   app.get("/decorators",async(req,res)=>{
    
    
    const result= await decoratorsCollection.find().toArray()
     res.send(result)
   })


 app.patch("/decorators/:id/approve",verifyToken,verifyAdmin,async(req,res)=>{
    const decoratorId = req.params.id;
    const { approveStatus, location } = req.body;
     const query={_id:new ObjectId(decoratorId)}

    const decorator = await decoratorsCollection.findOne(query);

    if (!decorator) {
      return res.send("Decorator not found" );
    }

    if (approveStatus === "approved") {
      if (!location) {
        return res.send("Location is required" );
      }

      const updateAsDecorator={
          $set: {
            approveStatus,
            location,
            workStatus: "available"
          }
        }
      await decoratorsCollection.updateOne(query,updateAsDecorator);

     //user role=decorator
      await usersCollection.updateOne(
         { _id: new ObjectId(decorator.userId) },
        { $set: { role: "decorator" } }
      );

      return res.send({
        success: true,
        message: "Decorator approved",
      });
    }

    
    if (approveStatus === "rejected") {
        const rejectReq={
          $set: {
            approveStatus,
            workStatus:"",
            location:""
          },
        }
      await decoratorsCollection.updateOne(
      query,
      rejectReq
        );

      return res.send({
        success: true,
        message: "Decorator rejected",
      });
    }

    res.status(400).send({ message: "Invalid approve status" });
   })












    //stripe related apis

    app.post('/create-checkout-session', async (req, res) => {
  const paymentInfo=req.body;
  const amount=parseInt(paymentInfo.totalCost)*100
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
        price_data:{
          currency:"usd",
          unit_amount:amount,
          product_data:{
             name:paymentInfo.serviceName
          }
        },
        quantity: 1,
      },
    ],
    customer_email:paymentInfo.clientEmail,
    mode: 'payment',
    metadata:{
      bookingId:paymentInfo.bookingId,
      serviceName:paymentInfo.serviceName,
      clientEmail:paymentInfo.clientEmail,
      bookingDate:paymentInfo.bookingDate,
      location:paymentInfo.location
     },

    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${process.env.SITE_DOMAIN}/dashboard/payment-cancel`
  });
  res.send({url: session.url})

  
});




//update the payment status---(pay to paid)
app.patch('/payment-success', verifyToken,async (req, res) => {
  const sessionId = req.query.session_id;   
  //console.log("Session ID:", sessionId);
  

   const session = await stripe.checkout.sessions.retrieve(sessionId);
   //console.log("after retrieve",session)

   const transactionId=session.payment_intent;


   // check if already exists
  const paymentExist = await paymentCollection.findOne({ transactionId });
  if (paymentExist) {
    return res.send({
      message: "Already exists",
      transactionId
    });
  }




    // If session is paid
  if (session.payment_status === "paid") {
    const id = session.metadata.bookingId;

    const result = await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          paymentStatus: "paid",
          status: "pending-decorator"
        }
      }
    );

    const payment = {
      amount: session.amount_total / 100,
      currency: session.currency,
      bookingId: session.metadata.bookingId,
      customer_email: session.customer_email,
      transactionId: session.payment_intent,
      serviceName: session.metadata.serviceName,
      paidAt: new Date(),
      paymentStatus: "paid",
      location: session.metadata.location,
      bookingDate: session.metadata.bookingDate
    };

    let resultPayment = await paymentCollection.insertOne(payment);

    return res.send({
      success: true,
      transactionId: session.payment_intent,
      modified: result,
      paymentInfo: resultPayment
    });
  }

  return res.send({ success: true });
});


//payment related apis

app.get("/payments",verifyToken,async(req,res)=>{
  const email=req.query.email
  const query={}
   const option={sort:{ paidAt: -1 }}
  if (email){
    query.customer_email=email
   
    //console.log(req.decodedEmail)
    if (email!==req.decodedEmail){
      return res.status(403).send({message:"forbidden access"})
      
    }

  }
  const result=await paymentCollection.find(query,option).toArray();
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