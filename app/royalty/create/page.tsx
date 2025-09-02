"use client";

import { useState, useEffect } from "react";
import {
  Page,
  Card,
  Form,
  FormLayout,
  TextField,
  Button,
  Thumbnail,
  InlineStack,
  BlockStack,
  Text,
  Toast,
  Frame,
  Divider,
  Banner,
  Spinner,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useRouter } from "next/navigation";

export default function AssignRoyalty() {
  const app = useAppBridge();
  const router = useRouter();

  const [shop, setShop] = useState<string>("");
  const [billingActive, setBillingActive] = useState<boolean | null>(null);

  const [selectedDesigner, setSelectedDesigner] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    title: string;
    image?: string;
    price?: string | number;
  } | null>(null);
  const [royalty, setRoyalty] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ✅ Toast
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");
  const [toastError, setToastError] = useState(false);

  const dismissToast = () => setToastActive(false);
  const showToast = (msg: string, isError = false) => {
    setToastContent(msg);
    setToastError(isError);
    setToastActive(true);
  };

  // ✅ Fetch shop & billing status
  useEffect(() => {
    const shopFromConfig = (app as any)?.config?.shop;
    if (shopFromConfig) {
      setShop(shopFromConfig);

      fetch(`/api/charges/status?shop=${shopFromConfig}`)
        .then((res) => res.json())
        .then((data) => setBillingActive(data.active))
        .catch(() => setBillingActive(false));
    }
  }, [app]);

  // ✅ Handle Royalty Assignment
  const handleSubmit = async () => {
    if (!selectedDesigner || !selectedProduct || !royalty) {
      showToast("All fields are required", true);
      return;
    }

    const numericRoyalty = parseFloat(royalty);
    if (isNaN(numericRoyalty) || numericRoyalty < 0 || numericRoyalty > 100) {
      showToast("Royalty must be between 0 and 100", true);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        designerId: selectedDesigner,
        productId: selectedProduct.id,
        title: selectedProduct.title,
        image: selectedProduct.image || null,
        price: selectedProduct.price
          ? parseFloat(selectedProduct.price as any)
          : null,
        Royality: numericRoyalty,
      };

      const res = await fetch(`/api/royality/product/create?shop=${shop}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Royalty assigned successfully!");
        setSelectedProduct(null);
        setSelectedDesigner("");
        setRoyalty("");
        router.push("/royalty");
      } else {
        showToast(data.error || "Failed to assign royalty", true);
      }
    } catch (err: any) {
      showToast(err.message || "Network error", true);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Product Picker (blocked if billing inactive)
  const selectProducts = async () => {
    if (!billingActive) {
      showToast("Please enable billing before selecting products", true);
      return;
    }

    const pickerResult = await (app as any).resourcePicker({
      type: "product",
      multiple: false,
    });

    const product = pickerResult?.selection?.[0];
    if (product) {
      setSelectedProduct({
        id: product.id.split("/").pop(),
        title: product.title,
        image: product.images?.[0]?.originalSrc || "",
        price: product.variants?.[0]?.price || 0,
      });
    } else {
      showToast("No product selected", true);
    }
  };

  return (
    <Frame>
      {toastActive && (
        <Toast
          content={toastContent}
          error={toastError}
          onDismiss={dismissToast}
        />
      )}

      <Page
        title="Assign Royalty"
        backAction={{ content: "Back", onAction: () => router.back() }}
        primaryAction={{
          content: "Save",
          onAction: handleSubmit,
          loading,
          disabled: loading || !billingActive,
        }}
      >
        {/* 🔔 Show banner if billing is not active */}
        {billingActive === false && (
          <Banner
            title="Enable billing to assign royalties"
            tone="critical"
          >
            <p>
              You need an enable a billing subscription before assigning royalties to products. 
              Please enable billing  first.
            </p>
          </Banner>
        )}

        {billingActive === null ? (
          <Spinner accessibilityLabel="Loading billing status" size="large" />
        ) : (
          <Form onSubmit={handleSubmit}>
            <BlockStack gap="600">
              {/* Product Section */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Product
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose the product you want to assign a royalty to.
                  </Text>
                  <Button onClick={selectProducts} disabled={!billingActive}>
                    {selectedProduct ? "Change Product" : "Choose Product"}
                  </Button>

                  {selectedProduct && (
                    <Card roundedAbove="sm">
                      <InlineStack gap="300" blockAlign="center">
                        <Thumbnail
                          size="large"
                          source={selectedProduct.image || ""}
                          alt={selectedProduct.title}
                        />
                        <BlockStack>
                          <Text as="h3" variant="bodyMd" fontWeight="bold">
                            {selectedProduct.title}
                          </Text>
                          <Text as="p" tone="subdued">
                            ${selectedProduct.price}
                          </Text>
                        </BlockStack>
                        <Button onClick={() => setSelectedProduct(null)}>
                          Remove
                        </Button>
                      </InlineStack>
                    </Card>
                  )}
                </BlockStack>
              </Card>

              {/* Designer + Royalty Section */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Royalty Details
                  </Text>
                  <Divider />
                  <FormLayout>
                    <TextField
                      label="Designer ID"
                      value={selectedDesigner}
                      onChange={setSelectedDesigner}
                      placeholder="Enter designer ID"
                      autoComplete="off"
                      disabled={!billingActive}
                    />

                    <TextField
                      label="Royalty Percentage"
                      type="number"
                      value={royalty}
                      onChange={setRoyalty}
                      min={0}
                      max={100}
                      suffix="%"
                      autoComplete="off"
                      disabled={!billingActive}
                    />
                  </FormLayout>
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        )}
      </Page>
    </Frame>
  );
}
