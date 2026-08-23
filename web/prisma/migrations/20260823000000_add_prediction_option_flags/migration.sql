-- Optional ISO-2 country flags for prediction-market outcomes.
ALTER TABLE "PredictionMarket" ADD COLUMN "optionFlagsJson" TEXT;
