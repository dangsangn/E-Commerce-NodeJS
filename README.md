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

### Setup mysql master slave replica

1. run mysql in master

- docker exec -it mysql_master mysql -uroot -proot
- CREATE USER 'replicator'@'%' IDENTIFIED BY 'replicator123';
  GRANT REPLICATION SLAVE ON _._ TO 'replicator'@'%';
  FLUSH PRIVILEGES;
- check user created is right.
  SELECT user, host, plugin FROM mysql.user WHERE user = 'replicator';
- check master info
  SHOW BINARY LOG STATUS;
  SHOW BINARY LOGS;

2. run mysql in slave

- docker exec -it mysql_slave mysql -uroot -proot
- Reset the slave completely and reconfigure with fresh values:
- example:
  STOP REPLICA;
  RESET REPLICA ALL;

  CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='mysql_master',
  SOURCE_USER='replicator',
  SOURCE_PASSWORD='replicator123',
  SOURCE_LOG_FILE='binlog.000004',
  SOURCE_LOG_POS=870,
  GET_SOURCE_PUBLIC_KEY=1;

  START REPLICA;
  SHOW REPLICA STATUS\G
