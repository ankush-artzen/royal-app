"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function HomePage() {
  const router = useRouter();
  const app = useAppBridge();

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<string | null>(null);

  // Stats
  const [productCount, setProductCount] = useState<number>(0);
  const [totalRoyaltyAmount, settotalRoyaltyAmount] = useState<number>(0);
  const [totalOrders, settotalOrders] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);

  //  shop
  useEffect(() => {
    const shopFromConfig = (app as any)?.config?.shop;
    console.log("App Bridge shop:", shopFromConfig);

    if (shopFromConfig) {
      setShop(shopFromConfig);
    } else {
      setError("Unable to retrieve shop info from App Bridge config");
    }
  }, [app]);

  // Fetch product + royalty stats
  useEffect(() => {
    if (!shop) return;
  
    async function fetchData() {
      setLoading(true);
      setError(null);
  
      try {
        // Fetch product counts
        const resCounts = await fetch(`/api/royality/counts?shop=${shop}`);
        const dataCounts = await resCounts.json();
  
        if (!resCounts.ok) {
          throw new Error(dataCounts?.error || "Failed fetching product counts");
        }
        setProductCount(dataCounts.totalProducts || 0);
  
        // Fetch total royalties and orders
        const resTotals = await fetch(`/api/royality/orders/counts?shop=${shop}`);
        const dataTotals = await resTotals.json();
  
        if (!resTotals.ok) {
          throw new Error(dataTotals?.error || "Failed fetching royalty totals");
        }
        settotalRoyaltyAmount(dataTotals.totalRoyaltyAmount || 0);
        settotalOrders(dataTotals.totalOrders || 0);
      } catch (err: any) {
        console.error("Error fetching stats:", err);
        setError(err.message || "Failed to fetch data");
        setProductCount(0);
        settotalRoyaltyAmount(0);
        settotalOrders(0);
      } finally {
        setLoading(false);
      }
    }
  
    fetchData();
  }, [shop]);
  
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400" align="center">
              <Text variant="heading2xl" as="h1" alignment="center">
                Welcome to Royalty App
              </Text>
              <Text as="p" variant="bodyLg" tone="subdued" alignment="center">
                Effortlessly manage products, assign royalties, and track
                performance
              </Text>
              <InlineStack gap="300" align="center">
                <Button
                  variant="primary"
                  onClick={() => router.push("/royalty/create")}
                >
                  Add Product
                </Button>
                <Button onClick={() => router.push("/royalty")}>
                  View Royalties
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {error && (
          <Layout.Section>
            <Banner title="Error" tone="critical">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Quick Insights */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" fontWeight="bold" variant="headingMd">
                Quick Insights
              </Text>
              <InlineStack gap="400" align="center" wrap={false}>
                <StatCard
                  title="Royalty Products"
                  value={productCount}
                  loading={loading}
                />

                <StatCard
                  title="Total Royalties"
                  value={`${totalRoyaltyAmount.toFixed(2)}`}
                  loading={loading}
                />

                <StatCard
                  title="Total orders"
                  value={`${totalOrders}`}
                  loading={loading}
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" fontWeight="bold" variant="headingMd">
              About Us{" "}
            </Text>
            <BlockStack gap="200" align="center">
              <Text
                as="p"
                variant="bodyLg"
                tone="subdued"
              >
                A royalty management system that tracks and calculates payments
                owed to creators. Collect sales data, aggregate earnings, and
                ensure timely distribution with ease.
              </Text>
              <Button
                variant="primary"
                onClick={() => router.push("/royalty/create")}
              >
                Get Started
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ✅ Reusable Card component for stats
function StatCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div style={{ minWidth: "250px", minHeight: "120px" }}>
      <Card>
        <BlockStack gap="200" align="center">
          <Text as="p" tone="subdued" fontWeight="bold" alignment="center">
            {title}
          </Text>
          {loading ? (
            <Spinner />
          ) : (
            <Text
              variant="heading2xl"
              as="h3"
              fontWeight="bold"
              alignment="center"
            >
              {value}
            </Text>
          )}
        </BlockStack>
      </Card>
    </div>
  );
}
