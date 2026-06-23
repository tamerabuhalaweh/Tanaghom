import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        outline: "border border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800",
        secondary: "bg-gray-800 text-gray-200 hover:bg-gray-700",
        ghost: "text-gray-400 hover:bg-gray-800 hover:text-gray-200",
        link: "text-blue-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-gray-700 bg-gray-800 text-gray-300",
        secondary: "border-gray-600 bg-gray-700 text-gray-200",
        destructive: "border-red-800 bg-red-900/50 text-red-400",
        outline: "border-gray-700 text-gray-400",
        success: "border-green-800 bg-green-900/50 text-green-400",
        warning: "border-yellow-800 bg-yellow-900/50 text-yellow-400",
        info: "border-blue-800 bg-blue-900/50 text-blue-400",
        mock: "border-purple-800 bg-purple-900/50 text-purple-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
