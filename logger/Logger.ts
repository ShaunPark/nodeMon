import { createLogger, format, transports } from "winston"

const env = process.env.NODE_ENV || "development"

const logger = createLogger({
  level: env === "development" ? "debug" : "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.json()
  ),
  transports: [
    new transports.Console({
      level: "info",
      format: format.combine(
        format.colorize(),
        format.printf(
          (info:any) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
  ]
})

export default logger