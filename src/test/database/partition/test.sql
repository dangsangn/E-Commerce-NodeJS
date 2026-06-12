CREATE TABLE orders (
  order_id INT,
  order_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, order_date)
)

PARTITION BY RANGE COLUMNS (order_date) (
  PARTITION p0 VALUES LESS THAN ('2024-01-01'),
  PARTITION p2025 VALUES LESS THAN ('2025-01-01'),
  PARTITION p2026 VALUES LESS THAN ('2026-01-01'),
  PARTITION pmax VALUES LESS THAN (MAXVALUE)
)

EXPLAIN SELECT * FROM orders;

-- insert some data
INSERT INTO orders (order_id, order_date, total_amount) VALUES (1, '2023-10-10', 100.00);
INSERT INTO orders (order_id, order_date, total_amount) VALUES (2, '2024-10-10', 150.00);
INSERT INTO orders (order_id, order_date, total_amount) VALUES (3, '2025-10-10', 200.00);
INSERT INTO orders (order_id, order_date, total_amount) VALUES (4, '2026-10-10', 250.00);

EXPLAIN SELECT * FROM orders PARTITION (p2025);

EXPLAIN SELECT * FROM orders WHERE order_date >= '2024-01-01' AND order_date < '2026-01-01';