This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Authentication Setup (Neon Auth / Stack Auth)

This project uses Stack Auth (formerly Neon Auth) for authentication.

### Setup Steps

1. **Create a project** at [https://app.stack-auth.com](https://app.stack-auth.com) and get your API keys

2. **Add environment variables** to your `.env.local` file:
   ```env
   NEXT_PUBLIC_STACK_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your_publishable_key_here
   STACK_SECRET_SERVER_KEY=your_secret_key_here
   DATABASE_URL=your_database_url_here
   ```

3. **Authentication Routes**:
   - Login: `/handler/login`
   - Signup: `/handler/signup`

The hamburger menu in the header provides access to login and signup pages through a sidebar interface.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
