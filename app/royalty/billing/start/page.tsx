"use client";

import { useState, useEffect } from "react";
import {
  Page,
  Card,
  Banner,
  Text,
  Button,
  Toast,
  BlockStack,
  InlineStack,
  Layout,
  Spinner,
  Frame,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import { useAppBridge } from "@shopify/app-bridge-react";

// ✅ Simple StatCard component
function StatCard({
  title,
  value,
  loading,
  tone = "base",
}: {
  title: string;
  value: string | number;
  loading?: boolean;
  tone?: "base" | "critical" | "success" | "subdued";
}) {
  console.log("StatCard render:", { title, value, loading, tone });
  return (
    <Card>
      <BlockStack gap="300" align="center">
        <Text as="h3" variant="headingMd">
          {title}
        </Text>
        {loading ? (
          <Spinner size="small" />
        ) : (
          <Text as="p" variant="headingLg" tone={tone} fontWeight="bold">
            {value}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

export default function HomePage() {
  const router = useRouter();
  const app = useAppBridge();

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [totalRoyaltyAmount, setTotalRoyaltyAmount] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);

  // Get shop from App Bridge
  useEffect(() => {
    const shopFromConfig = (app as any)?.config?.shop;
    console.log("App Bridge config shop:", shopFromConfig);
    if (shopFromConfig) setShop(shopFromConfig);
    else {
      setError("Unable to retrieve shop info from App Bridge config");
      setLoading(false);
    }
  }, [app]);

  // Fetch product/royalty stats
  useEffect(() => {
    if (!shop) return;

    async function fetchData() {
      console.log("Fetching product and royalty data for shop:", shop);
      try {
        const resCounts = await fetch(`/api/royality/counts?shop=${shop}`);
        const dataCounts = await resCounts.json();
        console.log("Counts API response:", dataCounts);
        if (resCounts.ok) setProductCount(dataCounts.totalProducts || 0);
        else setError(dataCounts.error || "Failed fetching counts");

        const resTotals = await fetch(
          `/api/royality/orders/counts?shop=${shop}`,
        );
        const dataTotals = await resTotals.json();
        console.log("Totals API response:", dataTotals);
        if (resTotals.ok) {
          setTotalRoyaltyAmount(dataTotals.totalRoyaltyAmount || 0);
          setTotalOrders(dataTotals.totalOrders || 0);
        } else setError(dataTotals.error || "Failed fetching totals");
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
        console.log("Data fetch finished. Loading:", false);
      }
    }

    fetchData();
  }, [shop]);

  const startRoyaltyPlan = async () => {
    if (!shop) return setPlanError("Shop info missing");

    setCreatingPlan(true);
    setPlanError(null);

    try {
      const res = await fetch("/api/charges/billing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Royalty Usage Plan",
          price: 0,
          cappedAmount: 5000,
          terms: `You will be billed royalties up to $5000/month`,
          test: true,
          shop,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create plan");

      const url = data.confirmationUrl || data.confirmation_url;
      if (!url) throw new Error("No confirmation URL returned from Shopify");

      window.open(url, "_blank");

      setConfirmationUrl(url);
    } catch (err: any) {
      console.error("Error creating royalty plan:", err);
      setPlanError(err.message || "Unexpected error occurred");
    } finally {
      setCreatingPlan(false);
    }
  };

  // Pay all pending royalties: create usage charge
  const payPendingRoyalties = async () => {
    if (!shop) return setPlanError("Shop info missing");

    if (totalRoyaltyAmount <= 0) {
      console.log("No royalties to pay");
      return setPlanError("No royalties to pay");
    }

    console.log(
      "Paying pending royalties:",
      totalRoyaltyAmount,
      "for",
      totalOrders,
      "orders",
    );
    setCreatingPlan(true);
    setPlanError(null);

    try {
      const res = await fetch(
        `/api/charges/billing/start/usage?shop=${encodeURIComponent(shop)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: `Royalty for ${totalOrders} sales`,
            price: Number(totalRoyaltyAmount.toFixed(2)),
          }),
        },
      );

      const data = await res.json();
      console.log("Usage charge API response:", data);

      if (!res.ok)
        throw new Error(data.error || "Failed to create usage charge");

      setToastActive(true);
      setTotalRoyaltyAmount(0);
      console.log("Royalty paid and totalRoyaltyAmount reset to 0");
    } catch (err: any) {
      console.error("Error creating usage charge:", err);
      setPlanError(err.message || "Unexpected error occurred");
    } finally {
      setCreatingPlan(false);
      console.log("Pay royalties finished. CreatingPlan:", false);
    }
  };

  console.log("HomePage render:", {
    shop,
    productCount,
    totalRoyaltyAmount,
    totalOrders,
    loading,
    creatingPlan,
    error,
    planError,
    confirmationUrl,
  });

  return (
    <Frame>
      <Page
        title="Royalty Billing"
        backAction={{ content: "Back", onAction: () => router.back() }}
      >
        <Layout.Section>
          <Card>
            <Banner title="Royalty payments" tone="info">
              <Text as="p">
                Track and distribute royalties to your designers automatically.
              </Text>
              <Text as="p" tone="subdued">
                First You have to Enable Royalty Billing , to pay total royality
                amount, Then you can pay usage charges for royalties.
              </Text>
            </Banner>
            <br />
            <Button
              variant="primary"
              disabled={loading || creatingPlan}
              loading={creatingPlan}
              onClick={startRoyaltyPlan}
            >
              Enable Royalty Billing
            </Button>
          </Card>
        </Layout.Section>

        {/* Quick Stats */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" fontWeight="bold" variant="headingMd">
                Quick Insights
              </Text>
              <Card background="bg-fill-active">
                <InlineStack align="center">
                  <BlockStack>
                    <Text as="h2" variant="headingMd" fontWeight="semibold">
                      Total Royalties Amount:
                    </Text>
                    <Text as="h2" variant="bodyMd" tone="subdued">
                      Total royalty tracked by all orders
                    </Text>
                  </BlockStack>

                  <BlockStack>
                    <Text as="h2" variant="headingLg" fontWeight="bold">
                      {totalRoyaltyAmount.toFixed(2)}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </Card>
            </BlockStack>
          </Card>
        </Layout.Section>

        {(error || planError) && (
          <Layout.Section>
            <Banner title="Error" tone="critical">
              <p>{error || planError}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Royalty Overview
              </Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodyLg">
                  Total Amount: <b>{totalRoyaltyAmount.toFixed(2)}</b>
                </Text>
                {/* <Button
                  variant="primary"
                  disabled={loading || creatingPlan || totalRoyaltyAmount === 0}
                  loading={creatingPlan}
                  onClick={payPendingRoyalties}
                >
                  Pay All Pending Royalties
                </Button> */}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Toast */}
        {toastActive && (
          <Toast
            content="Royalty marked as paid!"
            onDismiss={() => setToastActive(false)}
          />
        )}
      </Page>
    </Frame>
  );
}
