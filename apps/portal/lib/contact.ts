/**
 * Published contact details for the contact page.
 * The only email address on this page is `email` below.
 */
export const contact = {
  name: "Gopinath Merugumala",
  email: "gopinathmerugumala@gmail.com",
  profiles: [
    {
      id: "linkedin",
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/gopinath-merugumala/",
      handle: "gopinath-merugumala",
    },
    {
      id: "github",
      label: "GitHub",
      href: "https://github.com/GopinathM99",
      handle: "GopinathM99",
    },
    {
      id: "trailblazer",
      label: "Salesforce Trailblazer",
      href: "https://www.salesforce.com/trailblazer/gmerugumala",
      handle: "gmerugumala",
    },
    {
      id: "website",
      label: "Personal site",
      href: "https://www.gopinathmerugumala.com/",
      handle: "gopinathmerugumala.com",
    },
  ],
} as const;

export type ContactProfile = (typeof contact.profiles)[number];
