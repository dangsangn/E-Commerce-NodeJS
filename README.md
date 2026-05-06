### install kafka docker

- search kafka docker: docker search kafka
- pull kafka docker: docker pull apache/kafka:3.7.0
- create kafka network: docker network create kafka-network
- run kafka docker: docker run -d --name kafkaMQ \
   -p 9092:9092 \
   -e KAFKA_NODE_ID=1 \
   -e KAFKA_PROCESS_ROLES=broker,controller \
   -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
   -e KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
   -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
   -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT \
   -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
   -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
   apache/kafka:3.7.0

### install rabbitmq docker

- docker run -d --name rabbitmqMQ \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=myuser \
  -e RABBITMQ_DEFAULT_PASS=mypassword \
  rabbitmq:management
