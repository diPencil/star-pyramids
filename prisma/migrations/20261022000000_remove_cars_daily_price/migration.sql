-- DropOnly(cars.dailyPrice): remove the legacy daily rental rate column.
-- Transfer pricing is served exclusively by car_routes / car_route_prices;
-- this migration drops only this column and touches no table data.
ALTER TABLE `cars` DROP COLUMN `dailyPrice`;
