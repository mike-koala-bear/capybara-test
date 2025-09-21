import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // This will be replaced with actual backend verification
        // For now, we'll use a simple check
        if (credentials?.username && credentials?.password) {
          const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
          const response = await fetch(`${base}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          })

          if (response.ok) {
            const loginData = await response.json()
            const accessToken = loginData?.access_token
            if (!accessToken) return null

            // Fetch user profile to get id/name/email
            const meResp = await fetch(`${base}/auth/me`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            })
            if (!meResp.ok) return null
            const me = await meResp.json()

            return {
              id: me?.id,
              name: me?.username,
              email: me?.email,
              accessToken,
            }
          }
        }

        return null
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.accessToken = token.accessToken
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
