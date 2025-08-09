export default {
  providers: [
    {
      domain: "https://auth.sara.ai",
      applicationID: "read_by_ear_app",
      // JWT validation endpoint for Convex
      jwksUri: "https://auth.sara.ai/.well-known/jwks.json",
    },
  ],
};
