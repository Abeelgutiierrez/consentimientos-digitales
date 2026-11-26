# Demo (Fase 1) para Easypanel o cualquier host con Docker.
# No hay dependencias que instalar: pdf-lib y el generador de QR van incluidos en lib/vendor.
FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
  PORT=3000 \
  HOST=0.0.0.0 \
  TZ=Europe/Madrid

COPY --chown=node:node package.json server.js ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts

# data/ guarda db.json y los PDF firmados: móntalo como volumen para no perderlos al redesplegar.
# La primera vez se crea solo con los datos ficticios de la demo.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
