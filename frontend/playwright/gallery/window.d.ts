type MountParams = { story: string; props?: Record<string, unknown> };

declare global {
  interface Window {
    mount: (params: MountParams) => Promise<void>;
    unmount: () => Promise<void>;
  }
}

export {};
