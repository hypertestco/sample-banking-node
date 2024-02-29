process.env.HT_MODE = process.env.HT_MODE || 'RECORD';

const htSdk = require('@hypertestco/node-sdk');
const Date = htSdk.HtDate; // if you want to mock system time

/* -- DELETE befpre pushing to git -- */
const localServiceId = 'e700b4bd-7395-4217-988e-8bc4cc3bcfb6';
const remoteServiceId = '8e950615-2d5f-4e64-ac10-62d972e82c80'
const creds = require('../../creds.js');
const serviceId = creds.serviceIdentifer; //process.env.HT_SERVICE_ID; // set service id here

/* istanbul ignore next */
if (!serviceId) {
  throw new Error('Please set service id');
}

htSdk.initialize({ apiKey: 'DEMO-API-KEY', serviceId });


const opentelemetry= require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-grpc');

// Define your resource
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'sample-banking-app-node',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.1',
});

const sdk = new opentelemetry.NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    // url: "http://localhost:4317",
    // url: 'http://localhost:3008',
    url: creds.loggerUrl,
  }),
  instrumentations: [],
});

sdk.start();

htSdk.autoInstrumentation();
htSdk.setHtTracerProvider(sdk._tracerProvider);

const Fastify = require("fastify");
const { ApolloServer } = require("@apollo/server");

const fastifyApolloModule = require("@as-integrations/fastify");
const fastifyApollo = fastifyApolloModule.default;
const fastifyApolloDrainPlugin = fastifyApolloModule.fastifyApolloDrainPlugin;
// const { fastifyApollo, fastifyApolloDrainPlugin } = require("@as-integrations/fastify");
const resolvers = require("./schema/resolvers.js");
const typeDefs = require("./schema/typedefs.js");

const fastify = Fastify();

const apollo = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [fastifyApolloDrainPlugin(fastify)],
  // allowBatchedHttpRequests: true,
});
(async()=>{
  await apollo.start();

  await fastify.register(fastifyApollo(apollo));
})()

// Now, include the listen part here
fastify.listen({ port: 3000, host: 'localhost' }, function(err, address) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  htSdk.markAppAsReady();
  console.log(`Server listening at ${address}`);
});
