This is a [Next.js](https://nextjs.org/) project based on https://github.com/joacoc/materialize-nextjs-boilerplate.

## Running this yourself
### Set up your Kafka topic
You must configure your Kafka cluster and topic (e.g. via [Confluent Cloud](https://confluent.cloud/) such that you can use the [datagen](https://github.com/MaterializeInc/datagen) to write to it.

## Generate some data
Use the [datagen tool](https://github.com/MaterializeInc/datagen) to generate some data.
Use the [schema file](datagen/schema.json) checked into this repo.

A sample execution might look like
```
datagen -s ~/mz-purchase-demo/datagen/schema.json -f json -n 10
```

Confirm the data was written to Kafka.
In Confluent Cloud this can be done by:\
Clicking on your cluster &rarr; Topics &rarr; purchases topic &rarr; Messages tab &rarr; filter by "Jump to Offset" with value 0.

## Run Materialize locally
In another terminal, open the [Materialize repo](https://github.com/MaterializeInc/materialize) and run
```
./bin/environmentd -- --cors-allowed-origin='*'
```

## Create the source and view
In another terminal, connect to local psql.
```
psql -U materialize -h localhost -p 6875 materialize
```

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

## Running the Next.js web app
In another terminal, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the page.

It should look something like this
<img width="1087" alt="Screen Shot 2023-03-10 at 1 42 24 PM" src="https://user-images.githubusercontent.com/4186354/224404398-3506d25a-e0e3-4f83-ae3b-e0959a8a83f6.png">

## Add events to Kafka and see the UI live update
Run the datagen again with the UI open, and see the UI change live with each update. You can set the datagen tool to write a new record at a certain interval, which is best for this visualization. For example:
```
datagen -s ~/mz-purchase-demo/datagen/schema.json -f json -n 10 -w2000
```

It should look something like:
![purchase-demo-fast](https://user-images.githubusercontent.com/4186354/224407344-b0064f8e-3ef5-472d-b0df-a3925a6c465d.gif)

