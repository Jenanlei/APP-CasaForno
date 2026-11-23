# APP-CasaForno
Sitio web de Casa Forno (Spring Boot + Thymeleaf + MySQL).

## Ejecutar en local
1. Copia `.env.example` como `.env` y completa `DB_PASS`.
2. `./mvnw spring-boot:run` (requiere Java 21 y MySQL en localhost:3306).

## Variables de entorno (despliegue)
`DB_URL`, `DB_USER`, `DB_PASS`, `PORT`

## Despliegue
Se construye con el `Dockerfile` de la raíz (Maven + Java 21, JAR con Tomcat embebido).
