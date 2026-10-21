
export async function onRequestGet({ env }) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return Response.json(
      { error: "Supabase тохиргоо дутуу" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/manga?select=*&is_published=eq.true`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      }
    );

    const data = await response.json();

    return Response.json(data, {
      status: response.status
    });
  } catch (error) {
    return Response.json(
      { error: "Supabase холболтын алдаа" },
      { status: 500 }
    );
  }
}
