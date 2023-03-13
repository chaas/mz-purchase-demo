## Overview
This demo covers
1) Generating fake source data and writing it into Kafka using the [datagen tool](https://github.com/MaterializeInc/datagen)
2) Creating a source in Materialize against a live Kafka topic, then making a materialized view over it with a [sliding window temporal filter](https://materialize.com/docs/sql/patterns/temporal-filters/#sliding-windows)
3) Visualizing the result of the materialized view in a React app that live updates via websocket requests with SUBSCRIBE queries

The data being modeled is ecommerce purchases.\
The records are purchase transactions, where each purchase record has a location attached to it (in this simple example it's a US state).
We then visualize the volume of purchases by state in the past hour in a [proportional symbol map](https://en.wikipedia.org/wiki/Proportional_symbol_map).

This is a Next.js project based on https://github.com/joacoc/materialize-nextjs-boilerplate.
The React library [react-simple-maps](https://www.react-simple-maps.io/examples/proportional-symbol-map/) is used for the visualizations.

## Running this yourself
### Set up your Kafka topic
You must configure your Kafka cluster and topic (e.g. via [Confluent Cloud](https://confluent.cloud/)) such that you can use the [datagen](https://github.com/MaterializeInc/datagen) to write to it.

If using Confluent, you'll also need to set up the Schema Registry (CSR). You'll create one schema with the name `<cluster name>.<topic name>-key` and another  `<cluster name>.<topic name>-value`, for the Kafka topic's key and value schemas respectively. The schema files used for this demo are checked in here under the [csr subdirectory](https://github.com/chaas/mz-purchase-demo/tree/main/csr).

### Generate some data
Use the [datagen tool](https://github.com/MaterializeInc/datagen) to generate some data.
Use the [schema file](datagen/schema.json) checked into this repo.

A sample execution might look like
```
datagen -s ~/mz-purchase-demo/datagen/schema.json -f json -n 10
```

Confirm the data was written to Kafka.
In Confluent Cloud this can be done by:\
Clicking on your cluster &rarr; Topics &rarr; purchases topic &rarr; Messages tab &rarr; filter by "Jump to Offset" with value 0.

### Run Materialize locally
In another terminal, open the [Materialize repo](https://github.com/MaterializeInc/materialize) and run
```
./bin/environmentd -- --cors-allowed-origin='*'
```
You could also skip this step and use a real Materialize environment.

### Create the source and view
In another terminal, connect to psql.
```
psql -U materialize -h localhost -p 6875 materialize
```
If you're using a real Materialize environment, connect as your regularly would to your Materialize instance.

You'll have to use your Kafka (and if using Confluent, CSR) connection username and password. More info on that here https://materialize.com/docs/sql/create-connection/#kafka-auth-sasl-options.

Run the following sql
```
CREATE SECRET  kafka_user AS '<YOUR VALUE>';
CREATE SECRET kafka_password AS '<YOUR VALUE>';

CREATE CONNECTION kafka_connection TO KAFKA (
  BROKER '<YOUR VALUE>',
  SASL MECHANISMS = 'PLAIN',
  SASL USERNAME = SECRET kafka_user,
  SASL PASSWORD = SECRET kafka_password
);

CREATE SECRET csr_user AS '<YOUR VALUE>';
CREATE SECRET csr_password AS '<YOUR VALUE>';

CREATE CONNECTION csr_connection TO CONFLUENT SCHEMA REGISTRY (
  URL '<YOUR VALUE>',
  USERNAME = SECRET csr_user,
  PASSWORD = SECRET csr_password
);

CREATE SOURCE purchases
  FROM KAFKA CONNECTION kafka_connection (TOPIC 'purchases')
  FORMAT BYTES 
  INCLUDE TIMESTAMP
  ENVELOPE NONE
  WITH (SIZE = '1');

CREATE MATERIALIZED VIEW purchases_view AS SELECT  
    (data->>'id')::text AS "id",
    (data->>'user_id')::numeric AS "user_id",
    (data->>'item_id')::numeric AS "item_id",
    (data->>'price')::numeric AS "price",
    (data->>'city')::text AS "city",
    (data->>'state')::text AS "state",
    (data->>'zipcode')::text AS "zipcode",
    (data->>'created_at')::text AS "created_at",
    timestamp
  FROM (SELECT CONVERT_FROM(data, 'utf8')::jsonb AS data, timestamp FROM purchases);
  
CREATE VIEW last_hour AS SELECT * FROM purchases_view WHERE mz_now() < timestamp + INTERVAL '60 seconds';

CREATE MATERIALIZED VIEW by_state_last_hour AS SELECT state, count(*) FROM last_hour GROUP BY state;
```

Your source should now be all set.
You can run
```
SELECT * FROM purchases LIMIT 1;
SELECT * FROM purchases_view LIMIT 1;
```
to confirm everything is getting ingested correctly.

### Running the Next.js web app
In another terminal, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the page.

It should look something like this
<img width="1087" alt="Screen Shot 2023-03-10 at 1 42 24 PM" src="https://user-images.githubusercontent.com/4186354/224404398-3506d25a-e0e3-4f83-ae3b-e0959a8a83f6.png">

You'd have to make changes to this app source code to point it at a live Materialize instance, instead of local, which is hardcoded in. 

### Add events to Kafka and see the UI live update
Run the datagen again with the UI open, and see the UI change live with each update. You can set the datagen tool to write a new record at a certain interval, which is best for this visualization. For example:
```
datagen -s ~/mz-purchase-demo/datagen/schema.json -f json -n 10 -w2000
```

It should look something like:
![purchase-demo-fast](https://user-images.githubusercontent.com/4186354/224423752-37729a9d-b6c3-42f9-ba53-c234a0420b69.gif)

## Future improvements
Some ideas to expand on this further:
* Use zipcode instead of state for more granularity, and then use a library like [react-geocode](https://www.npmjs.com/package/react-geocode) to map it to the latitude and longitude
* Add in more source topics/tables (e.g. users, items) to exemplify joining across sources
