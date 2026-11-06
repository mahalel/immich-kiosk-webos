ARES ?= ares-package
DEVICE ?= lg-tv
BUILD_DIR := build

.PHONY: test package install launch clean

test:
	node --test test/*.test.js

package: test clean
	mkdir -p $(BUILD_DIR)
	$(ARES) app service -o $(BUILD_DIR) -n

install: package
	ares-install --device $(DEVICE) $(BUILD_DIR)/*.ipk

launch:
	ares-launch --device $(DEVICE) com.mahalel.immichkiosk

clean:
	rm -rf $(BUILD_DIR)
